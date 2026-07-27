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
 * This format is load-bearing, not cosmetic: the storage layer pulls the date
 * out by fixed offset — `file.originalname.substr(3, 10)` in
 * store-logs-api/src/modules/v1/desktop/service/screenshot.service.ts — so the
 * date must start at index 3. Hence the leading `HH-`.
 *
 *   13-2020-04-23 13-55-07-sc0.jpg
 *   ^^ hour       ^^^^^^^^^^ date+time  ^^^ screen index
 */
function screenshotFilename(date, screenIndex) {
    const hh = pad(date.getHours());
    const stamp =
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
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
