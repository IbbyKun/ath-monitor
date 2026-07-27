'use strict';

// Where the login token lives between runs.
//
// The token is a bearer credential for someone's monitoring account, so it
// gets `safeStorage` — DPAPI on Windows, Keychain on macOS, libsecret on
// Linux. When the OS keyring isn't available (a fresh Linux box with no
// keyring daemon) Electron says so, and we degrade to plaintext rather than
// locking the user out of their own agent. That trade-off is deliberate: the
// file sits in the per-user profile directory, which is the same place the
// token would have to be readable from anyway.

const { safeStorage } = require('electron');
const store = require('./store');

const KEY = 'session';

function save(session) {
    let stored = { ...session, encrypted: false };

    if (safeStorage.isEncryptionAvailable()) {
        stored = {
            encrypted: true,
            token: safeStorage.encryptString(session.token).toString('base64'),
            // Non-secret profile fields stay readable — they only identify
            // which account is signed in, and the UI needs them at startup.
            employeeId: session.employeeId,
            userId: session.userId,
            organizationId: session.organizationId,
            fullName: session.fullName,
            email: session.email,
            role: session.role,
        };
    }

    store.set(KEY, stored);
}

function load() {
    const stored = store.get(KEY, null);
    if (!stored || !stored.token) return null;

    if (!stored.encrypted) return stored;

    try {
        return {
            ...stored,
            encrypted: undefined,
            token: safeStorage.decryptString(Buffer.from(stored.token, 'base64')),
        };
    } catch (err) {
        // Happens when the OS user profile or keyring changed. The only
        // recovery is a fresh login.
        console.warn('[session] stored token could not be decrypted:', err.message);
        clear();
        return null;
    }
}

function clear() {
    store.remove(KEY);
}

module.exports = { save, load, clear };
