'use strict';

// Disk-backed retry queue.
//
// A dropped wifi connection is the normal case, not the exception — laptops
// sleep, move between networks and sit on hotel wifi. Without this, every
// failed flush would silently lose five minutes of somebody's working day, and
// they would only find out at payroll.
//
// One file per item rather than a single index: a half-written index file
// loses the whole queue, whereas a half-written item loses one item and is
// skipped on parse. Names are monotonic so directory order is send order.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { CONFIG } = require('./config');

let seq = 0;

function dir() {
    const d = path.join(app.getPath('userData'), 'queue');
    fs.mkdirSync(d, { recursive: true });
    return d;
}

function nextName() {
    // Timestamp keeps ordering across restarts; the counter breaks ties within
    // the same millisecond.
    seq = (seq + 1) % 1000;
    return `${Date.now()}-${String(seq).padStart(3, '0')}`;
}

/**
 * Persist a failed request for a later attempt.
 *
 * @param {'activity'|'screenshots'|'clock'} type
 * @param {object} payload  JSON body (screenshots: the {projectId, taskId} meta)
 * @param {Array<{filename: string, buffer: Buffer}>} [binaries] screenshot files
 */
function enqueue(type, payload, binaries = []) {
    const base = nextName();
    const files = [];

    try {
        binaries.forEach((bin, i) => {
            const stored = `${base}-${i}.bin`;
            fs.writeFileSync(path.join(dir(), stored), bin.buffer);
            files.push({ stored, filename: bin.filename });
        });

        fs.writeFileSync(
            path.join(dir(), `${base}.json`),
            JSON.stringify({ type, payload, files, queuedAt: new Date().toISOString(), attempts: 0 }),
            'utf8',
        );
    } catch (err) {
        console.error('[queue] could not persist item:', err.message);
        return false;
    }

    trim();
    return true;
}

/** @returns {Array<{id: string, type: string, payload: object, files: Array}>} */
function list() {
    let names;
    try {
        names = fs.readdirSync(dir()).filter((n) => n.endsWith('.json')).sort();
    } catch {
        return [];
    }

    const items = [];
    for (const name of names) {
        try {
            const raw = fs.readFileSync(path.join(dir(), name), 'utf8');
            items.push({ id: name.replace(/\.json$/, ''), ...JSON.parse(raw) });
        } catch {
            // Truncated by a crash mid-write — it can never be sent, so drop it
            // rather than blocking the queue behind it forever.
            remove(name.replace(/\.json$/, ''));
        }
    }
    return items;
}

/** Load the binaries belonging to a queued screenshot item. */
function readBinaries(item) {
    return (item.files || [])
        .map(({ stored, filename }) => {
            try {
                return { filename, buffer: fs.readFileSync(path.join(dir(), stored)) };
            } catch {
                return null;   // file vanished; upload what remains
            }
        })
        .filter(Boolean);
}

function remove(id) {
    const d = dir();
    try {
        const meta = JSON.parse(fs.readFileSync(path.join(d, `${id}.json`), 'utf8'));
        for (const { stored } of meta.files || []) {
            fs.rmSync(path.join(d, stored), { force: true });
        }
    } catch {
        // Metadata unreadable — still remove the json below, and sweep any
        // orphaned .bin files with the same prefix.
        try {
            for (const n of fs.readdirSync(d)) {
                if (n.startsWith(`${id}-`) && n.endsWith('.bin')) {
                    fs.rmSync(path.join(d, n), { force: true });
                }
            }
        } catch { /* nothing more we can do */ }
    }
    fs.rmSync(path.join(d, `${id}.json`), { force: true });
}

function markAttempt(id) {
    const file = path.join(dir(), `${id}.json`);
    try {
        const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
        meta.attempts = (meta.attempts || 0) + 1;
        fs.writeFileSync(file, JSON.stringify(meta), 'utf8');
        return meta.attempts;
    } catch {
        return 0;
    }
}

/** Drop the oldest items once the queue exceeds its cap. */
function trim() {
    let names;
    try {
        names = fs.readdirSync(dir()).filter((n) => n.endsWith('.json')).sort();
    } catch {
        return;
    }
    const excess = names.length - CONFIG.MAX_QUEUED_ITEMS;
    if (excess <= 0) return;

    console.warn(`[queue] over capacity, dropping ${excess} oldest item(s)`);
    for (const name of names.slice(0, excess)) {
        remove(name.replace(/\.json$/, ''));
    }
}

function size() {
    try {
        return fs.readdirSync(dir()).filter((n) => n.endsWith('.json')).length;
    } catch {
        return 0;
    }
}

module.exports = { enqueue, list, readBinaries, remove, markAttempt, size };
