'use strict';

// Generates a bcrypt hash for ADMIN_PASSWORD_HASH.
//
// The local admin login (src/routes/v1/auth.js, AUTH_METHOD_V3 branch) checks
// a submitted password against this hash instead of comparing plaintext
// against an env var, so the shared secret sitting in .env can't be read back
// out even by someone with file access to it.
//
// Usage:
//   node scripts/hash-admin-password.js '<new password>'

const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
    console.error('Usage: node scripts/hash-admin-password.js <password>');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('Hash:                     ' + hash);
// docker compose interpolates $ in .env files, so every literal $ in the
// hash must be doubled or compose silently mangles it. This is what to
// paste into ADMIN_PASSWORD_HASH= in .env — not the raw hash above.
console.log('.env-safe (paste this):   ' + hash.replace(/\$/g, '$$$$'));
