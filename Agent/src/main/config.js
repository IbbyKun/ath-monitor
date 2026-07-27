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
     * Seconds of no keyboard/mouse input before the time stops counting as
     * worked. Mirrors the server's `idleInMinute: 2` default.
     */
    IDLE_THRESHOLD_SEC: 120,

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
