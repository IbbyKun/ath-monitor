'use strict';

// Detects what is on screen but *not* being worked in — the second-monitor
// problem.
//
// Time is credited to the focused window, and rightly so: two windows cannot
// both own the same second, and inflating app usage would corrupt the
// productive-hours figure the whole system is built around. But that leaves a
// gap. Somebody typing in Excel on the main screen with a film playing beside
// it looks, in the timesheet, exactly like somebody just typing in Excel.
//
// So this reports background windows as *evidence* rather than as time: an
// event stream that says "this was on screen", which an admin can review and
// alert on, while the timesheet stays honest.
//
// **Occlusion is the hard part.** The OS lists open windows; it will not tell
// you which pixels are actually visible. On a single monitor the focused
// window usually covers the others, so reporting them would be guesswork and
// mostly wrong. What *can* be known for certain is which display a window sits
// on — so we only report windows on a display that does not hold the focused
// window. That is exactly the case worth catching, and it produces no false
// positives on a single-screen machine, where this module reports nothing at
// all.

const { screen } = require('electron');

/** Windows below this size are toolbars, notches and HUDs, not content. */
const MIN_WINDOW_AREA = 200 * 150;

function loadGetWindows() {
    // Pure ESM package, CommonJS main process.
    return import('get-windows');
}

/** Which display does a window's centre fall on? */
function displayIdFor(bounds) {
    if (!bounds || !bounds.width || !bounds.height) return null;
    const centre = {
        x: Math.round(bounds.x + bounds.width / 2),
        y: Math.round(bounds.y + bounds.height / 2),
    };
    return screen.getDisplayNearestPoint(centre).id;
}

/** Stable 1-based display number, so reports can say "display 2". */
function displayNumbers() {
    const map = new Map();
    screen.getAllDisplays().forEach((d, i) => map.set(d.id, i + 1));
    return map;
}

/**
 * The decision logic, split out from the IO so it can be exercised against
 * synthetic window lists — otherwise none of this is testable without
 * physically plugging in a second monitor.
 *
 * @param {Array} windows  raw openWindows() output, front-to-back
 * @param {{app: string, title: string}|null} focused
 * @returns {Array<{app: string, title: string, display: number}>}
 */
function selectBackgroundWindows(windows, focused) {
    if (!Array.isArray(windows) || windows.length === 0) return [];

    const numbers = displayNumbers();

    // Find the focused window's display by matching it in the list, so we use
    // the same bounds source for both sides of the comparison.
    const focusedEntry = focused
        ? windows.find((w) =>
            w.owner && w.owner.name === focused.app && (w.title || '') === focused.title)
        : null;
    const focusedDisplayId = focusedEntry ? displayIdFor(focusedEntry.bounds) : null;

    const seenDisplays = new Set();
    const results = [];

    // openWindows() returns front-to-back, so the first window found on a
    // display is the one actually looked at; anything under it is occluded.
    for (const win of windows) {
        const bounds = win.bounds;
        if (!bounds || bounds.width * bounds.height < MIN_WINDOW_AREA) continue;

        const displayId = displayIdFor(bounds);
        if (displayId === null || displayId === focusedDisplayId) continue;
        if (seenDisplays.has(displayId)) continue;

        const app = (win.owner && win.owner.name) || 'Unknown';
        const title = win.title || '';
        if (focused && app === focused.app && title === focused.title) continue;

        seenDisplays.add(displayId);
        results.push({ app, title, display: numbers.get(displayId) || 0 });
    }

    return results;
}

/**
 * Windows sitting on a display other than the focused one.
 *
 * @param {{app: string, title: string}|null} focused the active window
 * @returns {Promise<Array<{app: string, title: string, display: number}>>}
 *          At most one entry per display — the frontmost window on it.
 */
async function getBackgroundWindows(focused) {
    // Nothing to detect on a single-screen machine: any other window is either
    // behind the focused one or a sliver beside it, and we cannot tell which.
    if (screen.getAllDisplays().length < 2) return [];

    let windows;
    try {
        const mod = await loadGetWindows();
        windows = await mod.openWindows({ screenRecordingPermission: true });
    } catch {
        // Same permission story as the focused-window sampler; degrade quietly
        // rather than logging every minute for the life of the session.
        return [];
    }

    return selectBackgroundWindows(windows, focused);
}

module.exports = { getBackgroundWindows, selectBackgroundWindows };
