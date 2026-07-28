'use strict';

// Tracking constants, and the one piece of deployment config the agent needs:
// where the server lives.

const store = require('./store');

// The pilot server. Overridable at runtime from the login screen (handy while
// the Hostinger box is still being set up) and by env var for development.
const DEFAULT_SERVER_URL = 'http://localhost:8090';

const CONFIG = {
    /**
     * How often a batch of activity is flushed to the server, in seconds.
     *
     * 300 is not arbitrary: the backend's Joi schema caps each
     * `activityPerSecond` array at 400 entries
     * (store-logs-api/src/modules/v1/desktop/validation/user-activity.validation.ts),
     * and we write one entry per second, so the interval must stay under 400.
     */
    FLUSH_INTERVAL_SEC: 300,

    /** How often we sample "is the user active + what window is focused". */
    SAMPLE_INTERVAL_MS: 1000,

    /**
     * How often, in seconds, to check what is sitting on the *other* monitors.
     *
     * Far less often than the focused window: enumerating every open window is
     * heavier than reading the active one, and the question being answered
     * ("was a film on the second screen this afternoon?") does not need
     * five-second resolution. Each sample stands for this many seconds when
     * the duration is reported.
     */
    BACKGROUND_SAMPLE_SEC: 60,

    /**
     * Ignore a background window unless it was seen for at least this long.
     * Glancing at a second screen is not evidence of anything; keeping a film
     * open for ten minutes is. Also stops the event stream filling with
     * whatever was briefly dragged across a monitor.
     */
    BACKGROUND_MIN_REPORT_SEC: 120,

    /**
     * How long a *continuous* run of no input must last before any of it is
     * treated as idle, in seconds.
     *
     * The rule is all-or-nothing per run, not a running total:
     *   - stop for 4 minutes, then move the mouse -> nothing is deducted, the
     *     whole 4 minutes counts as worked time, and the run resets;
     *   - stop for 7 minutes -> all 7 minutes are deducted, not just the 2
     *     past the threshold.
     *
     * Short pauses are how people actually work — reading, thinking, talking
     * to someone at the desk — so charging them as idle would under-report
     * real work. A five-minute gap is a genuine break.
     *
     * This is only the fallback: the real value comes from the organisation's
     * `idleInMinute` setting via /desktop/feature-status.
     */
    DEFAULT_IDLE_MIN_RUN_SEC: 300,

    /**
     * Screenshots per hour. The server default is 9 (~1 every 7 minutes); the
     * real value is fetched per-user from /desktop/feature-status at login and
     * this is only the fallback if that call fails.
     */
    DEFAULT_SCREENSHOTS_PER_HOUR: 9,

    /** JPEG quality for uploaded screenshots. 60 keeps a 1080p frame ~120 KB. */
    SCREENSHOT_QUALITY: 60,

    /** Longest edge of an uploaded screenshot, px. Keeps storage predictable. */
    SCREENSHOT_MAX_WIDTH: 1600,

    /**
     * How often, in seconds, to check for USB storage being plugged in or out.
     *
     * Polling rather than OS event hooks: the hooks need a native module, and
     * a plug/unplug noticed within half a minute is entirely good enough for a
     * report nobody reads in real time.
     */
    USB_SAMPLE_SEC: 30,

    /** Retry queue cap. At one entry per 5 min this is ~4 days of offline work. */
    MAX_QUEUED_ITEMS: 1200,

    /** How often the retry queue tries to drain, in ms. */
    QUEUE_DRAIN_INTERVAL_MS: 60 * 1000,
};

// Development overrides. Waiting five minutes to see whether a flush works is
// not a practical test loop, so the two timings that gate verification can be
// shortened from the environment. Never set these in a shipped build — the
// flush interval in particular must stay under 400s or the server rejects the
// batch outright.
if (process.env.AGENT_FLUSH_INTERVAL_SEC) {
    CONFIG.FLUSH_INTERVAL_SEC = Math.min(399, Number(process.env.AGENT_FLUSH_INTERVAL_SEC));
}
if (process.env.AGENT_SCREENSHOTS_PER_HOUR) {
    CONFIG.DEFAULT_SCREENSHOTS_PER_HOUR = Number(process.env.AGENT_SCREENSHOTS_PER_HOUR);
}

function getServerUrl() {
    const url = process.env.AGENT_SERVER_URL || store.get('serverUrl', DEFAULT_SERVER_URL);
    return String(url).replace(/\/+$/, '');
}

function setServerUrl(url) {
    store.set('serverUrl', String(url).replace(/\/+$/, ''));
}

module.exports = { CONFIG, getServerUrl, setServerUrl, DEFAULT_SERVER_URL };
