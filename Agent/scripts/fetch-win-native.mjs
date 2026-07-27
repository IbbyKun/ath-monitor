#!/usr/bin/env node
//
// Fetch the Windows native addon for `get-windows` so a Windows installer can
// be built from macOS or Linux.
//
// Why this exists: `npm install` only ever fetches the addon for the machine
// you are standing on. Build the Windows installer on a Mac without this and
// you get an app that installs, launches, tracks time and screenshots
// perfectly — and silently reports no application data at all, because
// `preGyp.find()` falls back to a no-op stub when the binding is missing.
// There is no error and no crash. Just empty app-usage columns in the portal,
// which is a miserable thing to debug after the fact.
//
// The addon is prebuilt and published as a release tarball, so nothing is
// compiled here. There is no Windows toolchain requirement — only a download.
//
// Usage:  node scripts/fetch-win-native.mjs [--arch x64|ia32]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.join(__dirname, '..', 'node_modules', 'get-windows');

const arch = process.argv.includes('--arch')
    ? process.argv[process.argv.indexOf('--arch') + 1]
    : 'x64';

if (!['x64', 'ia32'].includes(arch)) {
    console.error(`Unsupported arch "${arch}" — expected x64 or ia32.`);
    process.exit(1);
}

function readPkg() {
    try {
        return JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
    } catch {
        console.error('get-windows is not installed. Run `npm install` first.');
        process.exit(1);
    }
}

const pkg = readPkg();
const version = pkg.version;

// Read the N-API version from the package rather than hardcoding it — if
// get-windows is upgraded and bumps napi_versions, a hardcoded 9 would fetch a
// tarball that no longer matches the path preGyp looks in, reintroducing the
// exact silent failure this script exists to prevent.
const napi = (pkg.binary && pkg.binary.napi_versions && pkg.binary.napi_versions.at(-1));
if (!napi) {
    console.error('Could not read binary.napi_versions from get-windows/package.json.');
    process.exit(1);
}

const name = `napi-${napi}-win32-unknown-${arch}`;
const url = `https://github.com/sindresorhus/get-windows/releases/download/v${version}/${name}.tar.gz`;
const destDir = path.join(PKG_DIR, 'lib', 'binding', name);

if (fs.existsSync(path.join(destDir, 'node-get-windows.node'))) {
    console.log(`✓ ${name} already present — nothing to do.`);
    process.exit(0);
}

console.log(`Fetching ${name} for get-windows@${version}…`);

const res = await fetch(url);
if (!res.ok) {
    console.error(`Download failed: ${res.status} ${res.statusText}\n  ${url}`);
    process.exit(1);
}

const tgz = Buffer.from(await res.arrayBuffer());
const tmp = path.join(PKG_DIR, 'lib', 'binding', `.${name}.tar`);
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, zlib.gunzipSync(tgz));

// `tar` is present on macOS and Linux, and the archive is a single .node file
// in one directory — not worth a dependency to unpack.
execFileSync('tar', ['-xf', tmp, '-C', path.dirname(tmp)]);
fs.rmSync(tmp, { force: true });

const binding = path.join(destDir, 'node-get-windows.node');
if (!fs.existsSync(binding)) {
    console.error(`Extracted, but ${binding} is missing — the archive layout changed.`);
    process.exit(1);
}

console.log(`✓ ${path.relative(path.join(__dirname, '..'), binding)}`);
console.log('  Windows window-tracking addon is in place; `npm run build:win` is safe to run.');
