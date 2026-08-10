'use strict';

// Silent auto-update against the self-hosted feed (see electron-builder.yml
// `publish`). No prompts, no employee-visible UI: this is managed software, and
// a dialog nobody is watching just means the fleet never updates.
//
// ── Check at launch, install the moment it lands ─────────────────────────────
// An earlier version of this file downloaded during the session, recorded the
// version in the store, and installed on the NEXT launch. It did not work, and
// the failure was invisible: the agent checked the feed on every launch,
// correctly skipped re-downloading the cached file, and then did nothing at
// all. electron-updater only emits `update-downloaded` in the process that
// actually performed the download — a later process with a valid cached file
// emits nothing, so the install branch was unreachable. Machines downloaded
// 0.2.2 and sat on 0.2.1 forever, re-checking every hour.
//
// So the download and the install now happen in the same process, which is the
// only sequence electron-updater guarantees. `update-downloaded` fires in the
// process that fetched the bytes, and that is where quitAndInstall is called.
//
// The check runs ONLY at launch, deliberately — no hourly polling. Because the
// install now follows the download immediately, an hourly check would mean a
// release published at 2pm restarting every agent mid-afternoon. At launch the
// restart costs a few seconds at the very start of the session, before anyone
// has done work worth interrupting. Tracking is tied to the Windows session, so
// launches happen daily and updates are never more than a day behind.
//
// This is also why installing at quit is not used: tracking ends at logout or
// shutdown, and Windows gives an exiting process a short, unreliable window in
// which to spawn a detached NSIS installer. Fast Startup makes it worse, since
// a "shutdown" frequently does not end the session at all.

const { app } = require('electron');

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
    // We install explicitly below. Leaving this on would also try to apply the
    // update during shutdown, which is the unreliable path described above.
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null;

    autoUpdater.on('error', (err) => {
        // Never fatal. A machine that cannot reach the feed must keep tracking.
        log(`updater: error ${err && err.message}`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        log(`updater: installing ${info.version}`);
        // (isSilent, isForceRunAfter) — no installer UI, relaunch afterwards.
        //
        // Deferred a tick: quitAndInstall does not return, and calling it from
        // inside the event handler can cut off electron-updater's own cleanup
        // of the downloaded file's bookkeeping.
        setImmediate(() => {
            try {
                autoUpdater.quitAndInstall(true, true);
            } catch (err) {
                log(`updater: quitAndInstall failed ${err && err.message}`);
            }
        });
    });

    autoUpdater.checkForUpdates().catch((err) => {
        log(`updater: check failed ${err && err.message}`);
    });
}

module.exports = { init };
