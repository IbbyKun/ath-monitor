'use strict';

// Silent auto-update against the self-hosted feed (see electron-builder.yml
// `publish`). No prompts, no employee-visible UI: this is managed software, and
// a dialog nobody is watching just means the fleet never updates.
//
// ── Why updates install at LAUNCH and not at quit ───────────────────────────
// electron-updater's default is `autoInstallOnAppQuit`, which applies the
// downloaded NSIS installer as the app exits. That is the wrong moment for this
// agent. Tracking is tied to the Windows session, so the app only ever quits at
// logout or shutdown — and that is precisely when Windows is least willing to
// let a process spawn a detached installer: the shutdown grace period is short,
// and late-stage shutdown can refuse or kill new processes outright. Updates
// would appear to download forever and never apply. Fast Startup compounds it,
// since a "shutdown" frequently does not end the session at all.
//
// So: download during the session (nothing is interrupted), stage it, and
// install at the START of the next session, before the timer begins. An update
// lands one login later, but it lands.
//
// The rejected alternative was installing the instant the download finished.
// That restarts the agent mid-session, and with a session-driven timer a
// restart can write a spurious stop/start pair into the day — which corrupts
// exactly the productive-time figures attendance is calculated from. A few
// seconds at session start is much cheaper than a bogus mid-day gap.

const { app } = require('electron');
const store = require('./store');

// Bumped only by this module. Holds the version staged on disk by a previous
// session and waiting to be installed at the next launch.
const PENDING_KEY = 'pendingUpdateVersion';
// Guards against a permanently un-installable update bootlooping the agent.
const ATTEMPTS_KEY = 'pendingUpdateAttempts';
const MAX_ATTEMPTS = 3;

// Re-checking hourly costs nothing and means a release reaches machines that
// stay logged in for days, rather than only those that log out.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function clearPending() {
    store.remove(PENDING_KEY);
    store.remove(ATTEMPTS_KEY);
}

/**
 * Wire up auto-updates. Safe to call unconditionally — it no-ops in
 * development and on any platform without a configured feed.
 *
 * @param {(msg: string) => void} [log] optional sink for diagnostics
 */
function init(log = () => {}) {
    // `app.isPackaged` is the only reliable gate: an unpackaged app has no
    // app-update.yml, and electron-updater throws rather than no-ops.
    if (!app.isPackaged) {
        log('updater: skipped (not packaged)');
        return;
    }

    // Windows only for now. macOS auto-update requires a signed and notarised
    // app, and we ship unsigned by decision (see electron-builder.yml).
    if (process.platform !== 'win32') {
        log(`updater: skipped (unsupported platform ${process.platform})`);
        return;
    }

    let autoUpdater;
    try {
        ({ autoUpdater } = require('electron-updater'));
    } catch (err) {
        log(`updater: electron-updater unavailable (${err.message})`);
        return;
    }

    autoUpdater.autoDownload = true;
    // Deliberately off — see the header. Installing happens in installStaged().
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null;

    const staged = store.get(PENDING_KEY, null);
    // A staged version equal to the running one means the install already
    // succeeded and the flag is stale.
    const hasStaged = !!staged && staged !== app.getVersion();

    autoUpdater.on('error', (err) => {
        // Never fatal. A machine that cannot reach the feed must keep tracking.
        log(`updater: error ${err && err.message}`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        if (hasStaged) {
            // Cached from a previous session, so this fired without a download.
            // Install now, before the timer starts.
            const attempts = Number(store.get(ATTEMPTS_KEY, 0)) + 1;
            if (attempts > MAX_ATTEMPTS) {
                log(`updater: giving up on ${info.version} after ${MAX_ATTEMPTS} attempts`);
                clearPending();
                return;
            }
            store.set(ATTEMPTS_KEY, attempts);
            // Flush synchronously: quitAndInstall does not come back, so a
            // buffered write would be lost and the counter would never advance.
            store.flushNow();
            log(`updater: installing staged ${info.version} (attempt ${attempts})`);
            // (isSilent, isForceRunAfter) — no installer UI, relaunch after.
            autoUpdater.quitAndInstall(true, true);
            return;
        }

        // Fresh download. Leave it on disk and pick it up next launch.
        log(`updater: staged ${info.version} for next launch`);
        store.set(PENDING_KEY, info.version);
        store.set(ATTEMPTS_KEY, 0);
    });

    autoUpdater.on('update-not-available', () => {
        // The feed has caught up with us; any staged version is moot.
        if (staged) clearPending();
    });

    const check = () => autoUpdater.checkForUpdates().catch((err) => {
        log(`updater: check failed ${err && err.message}`);
    });

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    // Do not hold the event loop open on quit.
    if (timer.unref) timer.unref();
}

module.exports = { init };
