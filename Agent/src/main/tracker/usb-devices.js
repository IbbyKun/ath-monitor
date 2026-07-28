'use strict';

// Detects USB **storage** being plugged in and pulled out.
//
// The requirement was explicitly "don't flag mice, monitors or headphones",
// and the way to guarantee that is not to enumerate USB devices and filter
// them — device-class heuristics are exactly where false positives come from,
// because a USB dock, a webcam with an SD slot or a phone in charging mode all
// blur the line.
//
// Instead this asks the operating system for **disks**, and narrows to the
// ones attached over USB. A mouse is never a disk. A monitor is never a disk.
// Nothing that is not storage can appear in the result, whatever it reports
// itself as, so there is no heuristic to tune and no class of device to
// mis-handle.
//
// Devices are identified by serial number where the OS provides one, falling
// back to model plus size. That matters for the diff: without a stable
// identity, replugging the same stick would look like a different device, and
// two identical sticks would look like one.

const { execFile } = require('child_process');

/** Enumeration must never hang the sampler. */
const COMMAND_TIMEOUT_MS = 10_000;

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: COMMAND_TIMEOUT_MS, windowsHide: true },
            (err, stdout) => (err ? reject(err) : resolve(stdout)));
    });
}

function formatSize(bytes) {
    const gb = Number(bytes) / 1e9;
    if (!Number.isFinite(gb) || gb <= 0) return null;
    return gb >= 1 ? `${gb.toFixed(gb < 10 ? 1 : 0)} GB` : `${Math.round(Number(bytes) / 1e6)} MB`;
}

/**
 * Windows: every physical disk whose interface is USB.
 *
 * Win32_DiskDrive only ever contains disks, so the InterfaceType filter is the
 * whole safety story — a USB headset cannot appear in this table.
 */
async function listWindows() {
    const script =
        "Get-CimInstance Win32_DiskDrive -Filter \"InterfaceType='USB'\" " +
        '| Select-Object Model,SerialNumber,Size | ConvertTo-Json -Compress';

    const stdout = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    const text = stdout.trim();
    if (!text) return [];

    // ConvertTo-Json emits a bare object for a single result, an array for many.
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    return rows.filter(Boolean).map((row) => {
        const model = String(row.Model || 'USB storage device').trim();
        const serial = String(row.SerialNumber || '').trim();
        const size = formatSize(row.Size);
        return {
            id: serial || `${model}|${row.Size || ''}`,
            label: size ? `${model} (${size})` : model,
        };
    });
}

/**
 * macOS: external physical disks. Development parity only — the fleet is
 * Windows. `diskutil list -plist external physical` excludes internal drives
 * and disk images, and again can only ever return storage.
 */
async function listMac() {
    const stdout = await run('/usr/sbin/diskutil', ['list', '-plist', 'external', 'physical']);

    // Pull the device identifiers out of the plist without an XML dependency,
    // then ask diskutil about each one.
    const ids = [...stdout.matchAll(/<string>(disk\d+)<\/string>/g)].map((m) => m[1]);
    const unique = [...new Set(ids)];

    const devices = [];
    for (const dev of unique) {
        try {
            const info = await run('/usr/sbin/diskutil', ['info', dev]);
            const pick = (label) => {
                const m = info.match(new RegExp(`${label}:\\s*(.+)`));
                return m ? m[1].trim() : '';
            };
            const name = pick('Device / Media Name') || 'USB storage device';
            const serial = pick('Disk / Partition UUID') || pick('Volume UUID') || dev;
            devices.push({ id: serial, label: name });
        } catch {
            devices.push({ id: dev, label: 'USB storage device' });
        }
    }
    return devices;
}

/**
 * Currently attached USB storage.
 *
 * @returns {Promise<Array<{id: string, label: string}>|null>} null means the
 *          enumeration failed — deliberately distinct from an empty array,
 *          because the caller must not read a failure as "everything was
 *          unplugged" and fire a burst of false removal events.
 */
async function listUsbStorage() {
    try {
        if (process.platform === 'win32') return await listWindows();
        if (process.platform === 'darwin') return await listMac();
        return [];   // Linux is not a target; report nothing rather than guess.
    } catch {
        return null;
    }
}

module.exports = { listUsbStorage };
