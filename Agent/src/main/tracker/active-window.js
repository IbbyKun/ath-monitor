'use strict';

// Thin wrapper around `get-windows`, whose behaviour differs enough per
// platform that the tracker should not have to care:
//
//   Windows — a plain N-API addon. No permission prompt, always works. This is
//             the pilot fleet, so this is the path that matters.
//   macOS   — a helper binary that needs the Accessibility permission. Until
//             the user grants it, every call fails.
//   Linux   — needs an X11 session; fails under Wayland.
//
// `get-windows` v9 is pure ESM and we are a CommonJS main process, so it has to
// come in through a dynamic import. That import is done once, lazily, and
// cached.
//
// Degrading is always preferred to crashing: without window info the agent
// still records worked time and screenshots, which is most of the value. We
// surface the reason once so it can be shown in the UI rather than silently
// producing empty app-usage reports.

let modulePromise = null;
let unavailableReason = null;
let warned = false;

function load() {
    if (!modulePromise) {
        modulePromise = import('get-windows').catch((err) => {
            unavailableReason = `Could not load window tracking: ${err.message}`;
            return null;
        });
    }
    return modulePromise;
}

/**
 * @returns {Promise<{app: string, title: string, url: string|null}|null>}
 *          null when the focused window can't be read (locked screen, missing
 *          permission, unsupported session).
 */
async function getActiveWindow() {
    const mod = await load();
    if (!mod) return null;

    try {
        // `screenRecordingPermission` is macOS-only and gates the *title* and
        // *url* fields — without it you get the app name and nothing else,
        // which is useless ("Excel" tells you nothing, "Excel — Q3
        // Forecast.xlsx" does). The agent already holds Screen Recording for
        // screenshots, so there is no extra prompt to avoid. Ignored on
        // Windows, where titles come from the Win32 API and need no grant.
        const win = await mod.activeWindow({ screenRecordingPermission: true });
        if (!win) return null;

        unavailableReason = null;
        return {
            app: (win.owner && win.owner.name) || 'Unknown',
            title: win.title || '',
            // Only Safari/Chrome on macOS populate this, and only with the
            // screen-recording permission. Browser URLs on Windows need the
            // extension (backlog 2.3); until then this stays null and the
            // portal shows "Chrome — <tab title>".
            url: win.url || null,
        };
    } catch (err) {
        const message = String(err.message || err);
        unavailableReason = /accessibility/i.test(message)
            ? 'Window tracking needs the Accessibility permission (System Settings › Privacy & Security › Accessibility).'
            : `Window tracking unavailable: ${message}`;

        if (!warned) {
            warned = true;   // once per run — this fires every sample otherwise
            console.warn('[active-window]', unavailableReason);
        }
        return null;
    }
}

/** Human-readable reason window tracking isn't working, or null if it is. */
function getUnavailableReason() {
    return unavailableReason;
}

module.exports = { getActiveWindow, getUnavailableReason };
