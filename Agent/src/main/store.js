'use strict';

// A deliberately tiny JSON store instead of `electron-store`.
//
// electron-store v10+ is pure ESM, which does not load from a CommonJS main
// process without dynamic import gymnastics, and v8 pulls in a schema
// validator we have no use for. We persist maybe six keys — a file read and a
// debounced write is the whole requirement.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const FILE = () => path.join(app.getPath('userData'), 'agent-config.json');

let cache = null;
let writeTimer = null;

function load() {
    if (cache) return cache;
    try {
        cache = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    } catch (err) {
        // ENOENT on first run is expected. A corrupt file is not, but starting
        // from defaults is still better than refusing to launch — the only
        // thing lost is the saved server URL, which the user can re-enter.
        if (err.code !== 'ENOENT') {
            console.error('[store] could not read config, starting fresh:', err.message);
        }
        cache = {};
    }
    return cache;
}

function flush() {
    writeTimer = null;
    try {
        fs.mkdirSync(path.dirname(FILE()), { recursive: true });
        fs.writeFileSync(FILE(), JSON.stringify(cache, null, 2), 'utf8');
    } catch (err) {
        console.error('[store] write failed:', err.message);
    }
}

function get(key, fallback) {
    const data = load();
    return key in data ? data[key] : fallback;
}

function set(key, value) {
    load()[key] = value;
    // Coalesce bursts (the tracker touches this on every flush).
    if (!writeTimer) writeTimer = setTimeout(flush, 250);
}

function remove(key) {
    delete load()[key];
    if (!writeTimer) writeTimer = setTimeout(flush, 250);
}

/** Force a synchronous write — call before the app quits. */
function flushNow() {
    if (writeTimer) clearTimeout(writeTimer);
    flush();
}

module.exports = { get, set, remove, flushNow };
