'use strict';

// The tracking loop.
//
// Shape of a session:
//
//   start()
//     ├─ every 1s   : record whether the user was active in that second
//     ├─ every 5s   : sample the focused window, extend/close an app segment
//     ├─ every ~400s: take a screenshot (jittered; rate comes from the server)
//     └─ every 300s : flush one activity batch + heartbeat the clock
//   stop()
//     └─ flush whatever is left, close the clock span
//
// Anything that fails to upload goes to the disk queue and is retried.

const os = require('os');
const EventEmitter = require('events');
const { powerMonitor } = require('electron');

const api = require('../api');
const queue = require('../queue');
const store = require('../store');
const { CONFIG } = require('../config');
const { captureAll } = require('./screenshots');
const { getActiveWindow, getUnavailableReason } = require('./active-window');
const { getBackgroundWindows } = require('./background-windows');

/** Sample the focused window every Nth tick — see WINDOW_SAMPLE_TICKS below. */
const WINDOW_SAMPLE_TICKS = 5;

/**
 * System-log category for "window seen on a non-focused display".
 *
 * The backend treats `type` as an opaque string and the portal filters on it,
 * so this is a namespace we allocate from: 1–5 are agent status and USB
 * events, 10 is app/web logs. Stored as a string because the Mongoose schema
 * declares it as one, and the query side casts to match.
 */
const SYSTEM_LOG_TYPE_BACKGROUND_WINDOW = '11';

class Tracker extends EventEmitter {
    constructor() {
        super();
        this.session = null;
        this.tickTimer = null;
        this.screenshotTimer = null;
        this.drainTimer = null;
        this.screenshotsPerHour = CONFIG.DEFAULT_SCREENSHOTS_PER_HOUR;
        this.idleMinRunSec = CONFIG.DEFAULT_IDLE_MIN_RUN_SEC;
        this.lastError = null;
        this.screenshotCount = 0;

        // Whether the *current* run of inactivity has already had its opening
        // stretch charged as idle. Lives on the tracker, not the interval,
        // because a run routinely spans a flush boundary — the threshold is
        // as long as the interval itself.
        this.idleRunCharged = false;
    }

    // ── lifecycle ───────────────────────────────────────────────────────────

    get isRunning() {
        return this.session !== null;
    }

    /**
     * @param {{token: string, employeeId: number}} auth
     * @param {number} [screenshotsPerHour] from the server's feature-status
     */
    start(auth, { screenshotsPerHour, idleMinutes } = {}) {
        if (this.session) return;

        this.auth = auth;
        // The server's per-org frequency wins, except when a developer has
        // explicitly pinned one to make a test loop bearable.
        if (screenshotsPerHour > 0 && !process.env.AGENT_SCREENSHOTS_PER_HOUR) {
            this.screenshotsPerHour = screenshotsPerHour;
        }
        if (idleMinutes > 0) this.idleMinRunSec = Math.round(idleMinutes * 60);

        const now = new Date();
        this.session = {
            startedAt: now,
            activeSeconds: 0,        // seconds with keyboard/mouse input
            idleExcludedSeconds: 0,  // seconds dropped by the idle-run rule
        };
        this.screenshotCount = 0;
        this.idleRunCharged = false;

        // Persisted so a crash mid-session can still be closed out on next
        // launch (see recoverInterruptedSession).
        store.set('activeSession', { startedAt: now.toISOString() });

        this._resetInterval(now);
        this.tickTimer = setInterval(() => this._tick(), CONFIG.SAMPLE_INTERVAL_MS);
        this._scheduleScreenshot();
        this._startQueueDrain();

        this.emit('status', this.getStatus());
    }

    async stop() {
        if (!this.session) return;

        clearInterval(this.tickTimer);
        clearTimeout(this.screenshotTimer);
        this.tickTimer = this.screenshotTimer = null;

        const endedAt = new Date();
        await this._flush(endedAt);
        await this._sendClock(this.session.startedAt, endedAt);

        store.remove('activeSession');
        this.session = null;
        this.interval = null;

        this.emit('status', this.getStatus());
    }

    getStatus() {
        return {
            running: this.isRunning,
            startedAt: this.session ? this.session.startedAt.toISOString() : null,
            activeSeconds: this.session ? this.session.activeSeconds : 0,
            idleExcludedSeconds: this.session ? this.session.idleExcludedSeconds : 0,
            idleMinRunSec: this.idleMinRunSec,
            screenshotCount: this.screenshotCount,
            queued: queue.size(),
            screenshotsPerHour: this.screenshotsPerHour,
            windowTrackingIssue: getUnavailableReason(),
            lastError: this.lastError,
        };
    }

    // ── per-second sampling ─────────────────────────────────────────────────

    _resetInterval(at) {
        this.interval = {
            startedAt: at,
            /** One 0/1 entry per elapsed second. Capped at 400 by the server. */
            activePerSecond: [],
            /** Seconds spent past the idle threshold — reported as break time. */
            breakSeconds: 0,
            /** @type {Array<{app,title,url,start,end}>} */
            segments: [],
            /**
             * Windows seen on non-focused displays, keyed "app|display".
             * Counted in samples, not seconds — multiplied out at flush.
             * @type {Map<string, {app: string, title: string, display: number, samples: number}>}
             */
            background: new Map(),
            ticks: 0,
        };
    }

    _tick() {
        const iv = this.interval;
        if (!iv) return;

        // getSystemIdleTime() is seconds since the last keyboard/mouse input,
        // OS-wide. It reports the length of the *current* run of inactivity,
        // which is exactly what the idle rule needs and, usefully, survives
        // flush boundaries without us having to track the run's start.
        const idle = powerMonitor.getSystemIdleTime();
        const isActive = idle === 0;

        iv.activePerSecond.push(isActive ? 1 : 0);
        if (isActive) this.session.activeSeconds += 1;

        this._accountForIdle(idle, iv);

        iv.ticks += 1;

        // Window sampling is throttled: on macOS this shells out to a helper
        // binary, so once a second would be needlessly expensive for 5s of
        // extra granularity.
        if (iv.ticks % WINDOW_SAMPLE_TICKS === 0) {
            this._sampleWindow().catch(() => { /* handled inside */ });
        }

        if (iv.ticks % CONFIG.BACKGROUND_SAMPLE_SEC === 0) {
            this._sampleBackground().catch(() => { /* handled inside */ });
        }

        const elapsed = iv.activePerSecond.length;
        if (elapsed >= CONFIG.FLUSH_INTERVAL_SEC) {
            this._flush(new Date()).catch((err) => console.error('[tracker] flush failed:', err.message));
        }

        // Cheap enough to emit every second; the renderer just re-renders text.
        this.emit('status', this.getStatus());
    }

    /**
     * Apply the idle rule for one tick.
     *
     * A run of inactivity is only deducted once it reaches `idleMinRunSec`,
     * and then the *whole* run is deducted — not just the part past the
     * threshold. So the moment the run crosses the line we charge everything
     * accumulated so far in one go, and every later second one at a time.
     * If input arrives before the line, nothing is ever charged and the run
     * simply resets: a four-minute pause counts as work.
     *
     * @param {number} idle seconds since the last input, OS-wide
     * @param {object} iv   the interval being accumulated
     */
    _accountForIdle(idle, iv) {
        if (idle === 0) {
            this.idleRunCharged = false;   // run broken — the next one starts fresh
            return;
        }
        if (idle < this.idleMinRunSec) return;   // not yet a break; may never be

        let charge = 1;
        if (!this.idleRunCharged) {
            // Crossing the threshold: bill the run retroactively. Clamp to the
            // interval so a run that began before this one cannot report more
            // break than the interval contains. The seconds before that point
            // were already reported as worked in the previous batch — the
            // day's total stays right, only the attribution shifts forward.
            charge = Math.min(idle, iv.activePerSecond.length);
            this.idleRunCharged = true;
        }

        iv.breakSeconds += charge;
        this.session.idleExcludedSeconds += charge;
    }

    async _sampleWindow() {
        const iv = this.interval;
        if (!iv) return;

        const win = await getActiveWindow();
        const offset = iv.activePerSecond.length;
        const last = iv.segments[iv.segments.length - 1];

        if (!win) {
            // Screen locked, permission missing, or no focused window. Close
            // the open segment so idle time isn't attributed to whatever app
            // happened to be focused before the lock.
            if (last && last.end === null) last.end = offset;
            return;
        }

        if (last && last.end === null && last.app === win.app && last.title === win.title) {
            return;   // same window still focused — segment just keeps growing
        }
        if (last && last.end === null) last.end = offset;

        iv.segments.push({
            app: win.app,
            title: win.title,
            url: win.url,
            start: offset,
            end: null,
        });
    }

    /**
     * Note what is sitting on the other monitors. Cheap because it runs once a
     * minute, and a no-op entirely on single-screen machines.
     */
    async _sampleBackground() {
        const iv = this.interval;
        if (!iv) return;

        // A machine nobody is touching is not "watching something on the
        // second screen" — it is just left on. Charging idle time as evidence
        // would be unfair and noisy.
        if (powerMonitor.getSystemIdleTime() >= this.idleMinRunSec) return;

        const open = iv.segments[iv.segments.length - 1];
        const focused = open && open.end === null
            ? { app: open.app, title: open.title }
            : null;

        const windows = await getBackgroundWindows(focused);
        for (const win of windows) {
            // Keyed on app + display, not title: a browser retitles itself on
            // every tab change, and "Chrome was on display 2 for an hour" is
            // the useful statement, not sixty one-minute fragments.
            const key = `${win.app}|${win.display}`;
            const entry = iv.background.get(key);
            if (entry) {
                entry.samples += 1;
                entry.title = win.title || entry.title;   // keep the latest
            } else {
                iv.background.set(key, { ...win, samples: 1 });
            }
        }
    }

    /**
     * Turn accumulated background sightings into system-log events.
     * Returns [] when there is nothing worth reporting.
     */
    _buildBackgroundEvents(iv, at) {
        const events = [];
        const computer = os.hostname();

        for (const win of iv.background.values()) {
            const seconds = win.samples * CONFIG.BACKGROUND_SAMPLE_SEC;
            if (seconds < CONFIG.BACKGROUND_MIN_REPORT_SEC) continue;

            const minutes = Math.round(seconds / 60);
            events.push({
                dataId: at.toISOString(),
                title: win.app,
                // Type 11 — a new system-log category. 1–5 and 10 are already
                // taken by agent status, USB events and app/web logs.
                type: SYSTEM_LOG_TYPE_BACKGROUND_WINDOW,
                computer,
                description:
                    `On display ${win.display} for about ${minutes} min without being worked in` +
                    (win.title ? ` — "${win.title}"` : ''),
            });
        }
        return events;
    }

    // ── flushing ────────────────────────────────────────────────────────────

    async _flush(at) {
        const iv = this.interval;
        if (!iv || iv.activePerSecond.length === 0) return;

        const elapsed = iv.activePerSecond.length;
        const open = iv.segments[iv.segments.length - 1];
        if (open && open.end === null) open.end = elapsed;

        const payload = this._buildActivityPayload(iv, elapsed, at);
        const backgroundEvents = this._buildBackgroundEvents(iv, at);

        // Start the next interval before awaiting the network, so a slow
        // upload doesn't create a gap in coverage.
        this._resetInterval(at);

        await this._send('activity', payload);
        if (backgroundEvents.length) {
            await this._send('system-logs', { events: backgroundEvents });
        }
        await this._sendClock(this.session.startedAt, at);
    }

    _buildActivityPayload(iv, elapsed, at) {
        const zeros = new Array(elapsed).fill(0);

        // appUsage must contain at least one entry (the server's Joi schema
        // uses .min(1)). If we never resolved a window — no permission, or the
        // machine was locked the whole interval — send one honest placeholder
        // rather than an empty array that would be rejected wholesale.
        const appUsage = iv.segments.length
            ? iv.segments.map((s) => ({
                ageOfData: -1,
                app: s.app,
                title: s.title,
                // Must be a valid URI or null — the server runs Joi's .uri()
                // on it. Restricted to http(s) rather than any scheme: the
                // portal only ever renders web URLs, and anything else would
                // pass .uri() while being meaningless in the report.
                url: s.url && /^https?:\/\//i.test(s.url) ? s.url : null,
                start: s.start,
                end: s.end === null ? elapsed : s.end,
                keystrokes: '',   // keystroke *content* is deliberately never captured
            }))
            : [{
                ageOfData: -1,
                app: 'Unknown',
                title: '',
                url: null,
                start: 0,
                end: elapsed,
                keystrokes: '',
            }];

        const dataId = iv.startedAt.toISOString();

        return {
            // `sign` is a per-batch identifier: <dataId>_<employeeId>.
            sign: `${dataId}_${this.auth.employeeId}`,
            data: [{
                dataId,
                systemTimeUtc: at.toISOString(),

                projectId: 0,
                taskId: 0,
                taskNote: '',

                // Clamped: a retroactive charge for a run that started in an
                // earlier interval could otherwise exceed this interval's own
                // length, which would be nonsense to the reporting side.
                breakInSeconds: Math.min(iv.breakSeconds, elapsed),

                // v1 has no input hooks, so we cannot separate clicks from
                // keypresses — uiohook-napi is backlog 2.2. What we do have is
                // a genuine per-second active/idle signal from the OS, and it
                // is reported in `mouseMovements` because that is the field
                // the portal's activity percentage reads. The three counters
                // we cannot measure stay honestly at zero.
                clicksCount: 0,
                keysCount: 0,
                fakeActivitiesCount: 0,
                movementsCount: iv.activePerSecond.reduce((a, b) => a + b, 0),

                activityPerSecond: {
                    buttonClicks: zeros,
                    fakeActivities: zeros,
                    keystrokes: zeros,
                    mouseMovements: iv.activePerSecond,
                },

                mode: { name: 'computer', start: 0, end: elapsed },
                appUsage,
            }],
        };
    }

    async _sendClock(startedAt, endedAt) {
        // The server upserts on (attendance, start_time, type, mode), so
        // re-sending the same start with a later end just extends the span.
        // That makes this a safe heartbeat: a crash loses one interval, not
        // the whole session.
        await this._send('clock', {
            startDate: startedAt.toISOString(),
            endDate: endedAt.toISOString(),
            type: 1,
            mode: 2,
        });
    }

    // ── screenshots ─────────────────────────────────────────────────────────

    _scheduleScreenshot() {
        const baseSec = 3600 / this.screenshotsPerHour;
        // Jitter around the mean so shots aren't predictable to the second,
        // while the hourly rate still comes out right.
        const delay = (baseSec * 0.5 + Math.random() * baseSec) * 1000;

        this.screenshotTimer = setTimeout(async () => {
            await this._takeScreenshot();
            if (this.isRunning) this._scheduleScreenshot();
        }, delay);
    }

    async _takeScreenshot() {
        if (!this.isRunning) return;

        // Don't spend storage on a locked or abandoned machine — those seconds
        // are already excluded from worked time, so the frames would show
        // nothing anyone will look at. 40-day retention makes this worth doing.
        if (powerMonitor.getSystemIdleTime() >= this.idleMinRunSec) return;

        let shots;
        try {
            shots = await captureAll();
        } catch (err) {
            this.lastError = err.message;
            this.emit('status', this.getStatus());
            return;
        }
        if (!shots.length) return;

        this.screenshotCount += shots.length;
        await this._send('screenshots', { projectId: 0, taskId: 0 }, shots);
    }

    // ── delivery + retry ────────────────────────────────────────────────────

    /** Try to send now; on failure persist for the drain loop. */
    async _send(type, payload, binaries = []) {
        try {
            await this._deliver(type, payload, binaries);
            this.lastError = null;
            return true;
        } catch (err) {
            if (err.isAuthError) {
                // The session is gone server-side. Queueing would just pile up
                // requests that can never succeed, so surface it instead.
                this.lastError = 'Session expired — please sign in again.';
                this.emit('auth-expired');
                return false;
            }
            this.lastError = err.message;
            queue.enqueue(type, payload, binaries);
            this.emit('status', this.getStatus());
            return false;
        }
    }

    _deliver(type, payload, binaries) {
        const token = this.auth.token;
        switch (type) {
            case 'activity':
                return api.sendActivity(token, payload);
            case 'screenshots':
                return api.uploadScreenshots(token, binaries, payload);
            case 'system-logs':
                return api.sendSystemLogs(token, payload.events);
            case 'clock':
                return api.recordClock(token, payload);
            default:
                throw new Error(`Unknown queue item type: ${type}`);
        }
    }

    _startQueueDrain() {
        if (this.drainTimer) return;
        this.drainTimer = setInterval(() => {
            this.drainQueue().catch(() => { /* retried next tick */ });
        }, CONFIG.QUEUE_DRAIN_INTERVAL_MS);
    }

    stopQueueDrain() {
        clearInterval(this.drainTimer);
        this.drainTimer = null;
    }

    /** Send everything the queue is holding, oldest first. */
    async drainQueue() {
        if (!this.auth || !this.auth.token) return;

        for (const item of queue.list()) {
            const binaries = item.type === 'screenshots' ? queue.readBinaries(item) : [];
            try {
                await this._deliver(item.type, item.payload, binaries);
                queue.remove(item.id);
            } catch (err) {
                if (err.isAuthError) {
                    this.emit('auth-expired');
                    return;
                }
                // Still offline — stop here so ordering is preserved, and try
                // the whole queue again on the next drain.
                const attempts = queue.markAttempt(item.id);
                if (attempts > 50) {
                    console.warn(`[tracker] dropping item ${item.id} after ${attempts} attempts`);
                    queue.remove(item.id);
                }
                break;
            }
        }
        this.emit('status', this.getStatus());
    }

    /**
     * If a previous run died mid-session, close its clock span so the day's
     * total isn't silently short. We only know when it started, so we credit
     * up to the last flush — an under-count, never an over-count.
     */
    async recoverInterruptedSession(auth) {
        const stale = store.get('activeSession', null);
        if (!stale || !stale.startedAt) return;

        store.remove('activeSession');
        this.auth = auth;
        try {
            await this.drainQueue();
        } catch { /* the drain loop will retry */ }
    }
}

module.exports = new Tracker();
