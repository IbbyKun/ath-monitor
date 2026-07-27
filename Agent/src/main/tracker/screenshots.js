'use strict';

// Screen capture via Electron's built-in desktopCapturer — no native module,
// nothing extra to ship, and it already handles multi-monitor.

const { desktopCapturer, screen, systemPreferences } = require('electron');
const { CONFIG } = require('../config');

function pad(n) {
    return String(n).padStart(2, '0');
}

/**
 * Build the filename the backend expects.
 *
 * This format is load-bearing, not cosmetic, in two separate ways:
 *
 * 1. The storage layer pulls the date out by fixed offset —
 *    `file.originalname.substr(3, 10)` in store-logs-api's
 *    screenshot.service.ts — and uses it as the folder name. So the date must
 *    start at index 3, which is what the leading `HH-` is for.
 *
 *      13-2020-04-23 13-55-07-sc0.jpg
 *      ^^ hour       ^^^^^^^^^^ date+time  ^^^ screen index
 *
 * 2. **The timestamp must be UTC.** The admin service parses it back with
 *    `moment.utc(...)` (Common.js `toTimezoneDateofSSTimeWithDate`) and then
 *    converts to the employee's timezone for display, and it builds its S3
 *    lookup prefix from the UTC date. Writing local time here shifts every
 *    screenshot by the UTC offset: the gallery queries the hour the user
 *    actually worked and finds nothing, while the files sit in the bucket
 *    under a different hour. Near midnight the date folder is wrong too.
 */
function screenshotFilename(date, screenIndex) {
    const hh = pad(date.getUTCHours());
    const stamp =
        `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
        `${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
    return `${hh}-${stamp}-sc${screenIndex}.jpg`;
}

/**
 * Capture every connected display.
 *
 * @returns {Promise<Array<{filename: string, buffer: Buffer}>>} one entry per
 *          display; empty if capture is blocked or no source is available.
 */
async function captureAll() {
    // macOS gates screen capture behind a permission the user grants once in
    // System Settings. Without this check desktopCapturer returns black frames
    // rather than throwing, which would silently upload useless screenshots.
    if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('screen');
        if (status !== 'granted') {
            throw new Error(
                'Screen Recording permission is not granted (System Settings › Privacy & Security › Screen Recording).',
            );
        }
    }

    // Size the capture off the largest display, capped, then let each frame
    // keep its own aspect ratio on resize below.
    const displays = screen.getAllDisplays();
    const largest = displays.reduce(
        (max, d) => Math.max(max, d.size.width * d.scaleFactor),
        1920,
    );
    const width = Math.min(largest, CONFIG.SCREENSHOT_MAX_WIDTH);

    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height: Math.round((width * 9) / 16) },
        fetchWindowIcons: false,
    });

    const takenAt = new Date();
    const shots = [];

    sources.forEach((source, index) => {
        let image = source.thumbnail;
        if (image.isEmpty()) return;

        // Preserve aspect ratio — passing only `width` makes Electron derive
        // the height, so ultrawide and portrait monitors aren't distorted.
        if (image.getSize().width > CONFIG.SCREENSHOT_MAX_WIDTH) {
            image = image.resize({ width: CONFIG.SCREENSHOT_MAX_WIDTH, quality: 'good' });
        }

        shots.push({
            filename: screenshotFilename(takenAt, index),
            buffer: image.toJPEG(CONFIG.SCREENSHOT_QUALITY),
            takenAt: takenAt.toISOString(),
        });
    });

    return shots;
}

module.exports = { captureAll, screenshotFilename };
