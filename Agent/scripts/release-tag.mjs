#!/usr/bin/env node

// Commit the version bump and create the tag the release workflow triggers on.
//
// This exists because `npm version patch` does NOT do it, in two ways that both
// look like success:
//
//   1. npm only touches git when `.git` sits in the package directory. Ours is
//      the repo root, one level up — so `npm version` bumps package.json and
//      package-lock.json, creates no commit and no tag, and exits 0 printing
//      the new version. The version has moved, so it reads as done. Nothing
//      ships.
//
//   2. `git push --follow-tags` pushes only ANNOTATED tags. A lightweight tag
//      from a plain `git tag agent-v1.2.3` is silently left behind on the
//      machine, and again the push reports success.
//
// Both failures are invisible: the fleet simply never receives an update, and
// there is nothing in the output to suggest why.
//
// Run via `npm run release` from Agent/, which does the version math first.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const agentDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(agentDir);

const git = (...args) =>
    execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();

const { version } = JSON.parse(
    readFileSync(path.join(agentDir, 'package.json'), 'utf8'),
);
const tag = `agent-v${version}`;

// electron-updater compares the feed's version against the installed one, so a
// release that reuses a version is invisible to every agent. Fail loudly here
// rather than ship something nobody receives.
if (git('tag', '-l', tag)) {
    console.error(`${tag} already exists.`);
    console.error('Bump to a new version — reusing one ships nothing.');
    process.exit(1);
}

const staged = git('status', '--porcelain', 'Agent/package.json', 'Agent/package-lock.json');
if (!staged) {
    console.error('package.json is unchanged — did the version bump run?');
    console.error('Use `npm run release`, which bumps before tagging.');
    process.exit(1);
}

git('add', 'Agent/package.json', 'Agent/package-lock.json');
git('commit', '-m', `chore(agent): release ${version}`);
// -a for annotated. See note 2 above.
git('tag', '-a', tag, '-m', `ATH Monitor Agent ${version}`);

console.log(`Committed and tagged ${tag}.`);
console.log('\nPush it with:\n\n    git push origin main --follow-tags\n');
