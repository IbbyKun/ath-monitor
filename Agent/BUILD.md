# Building and distributing the desktop agent

A self-contained runbook. Follow it top to bottom on a machine that has never
seen this project and you will end up with an installer employees can run.

If you only want to know what the agent *does*, read
[`README.md`](README.md) instead.

---

## TL;DR

```bash
git clone <repo-url>
cd ath-monitor/Agent
npm install
npm run build:win
```

Output: `Agent/dist/ATH Monitor Agent Setup <version>.exe` (~96 MB).

**This works on macOS, Linux and Windows alike.** No VM, no Wine, no Windows
machine required. Read [Why cross-building works](#why-cross-building-works)
before changing anything about it, because there is one step that must not be
skipped and fails silently if it is.

---

## 1. Prerequisites

| Need | Version | Check with |
|---|---|---|
| Node.js | 20 or newer (22 recommended) | `node -v` |
| npm | 10 or newer | `npm -v` |
| Git | any | `git --version` |
| Disk space | ~1.5 GB | Electron plus its build cache |

Nothing else. No Visual Studio, no Python, no build toolchain — the one native
dependency ships prebuilt.

**Internet access is required for the first build.** It downloads the Electron
runtime (~100 MB), NSIS, and the Windows native addon. Later builds work
offline from the npm and Electron caches.

---

## 2. Install

```bash
cd Agent
npm install
```

If you see peer-dependency complaints, `npm install --legacy-peer-deps`. Do
**not** use `npm ci --omit=dev` — electron-builder is a devDependency and the
build needs it.

---

## 3. Point it at your server

The agent has a built-in default server address, and users can override it on
the sign-in screen under **Server settings**. For a build going out to
employees, set the default to your real server so nobody has to type anything.

Edit `src/main/config.js`:

```js
const DEFAULT_SERVER_URL = 'https://monitor.yourdomain.com';
```

Use the address the **browser** would use — the same one people open the portal
with. Not an internal Docker hostname, not `localhost`.

Bump the version in `package.json` at the same time. `electron-updater` and the
installer both key off it, and shipping two different builds as `0.1.0` will
confuse everyone including you.

---

## 4. Build

```bash
npm run build:win          # Windows installer, x64
npm run build:mac          # macOS .dmg — development only
npm run pack               # unpacked folder, no installer; fastest for testing
```

`build:win` runs two steps:

1. `scripts/fetch-win-native.mjs` — downloads the Windows native addon.
2. `electron-builder --win --x64` — packages and builds the NSIS installer.

Expect 2–5 minutes for a first build, under a minute afterwards.

### Verifying the build is actually complete

A Windows build made on macOS or Linux can look perfect and still be broken in
one specific way. Check it:

```bash
# Must list a napi-*-win32-*/node-get-windows.node file
find dist/win-unpacked -name '*.node' | grep win32
```

If that returns nothing, **do not distribute the installer.** The agent will
install, run, track time and take screenshots perfectly — and report no
application data at all, with no error anywhere. See below for why.

---

## Verifying on Windows (copy-paste)

Hand this to whoever has the Windows machine. It builds, checks the two things
that fail silently, and tells you what to look for.

```powershell
# 1. Build
git clone https://github.com/IbbyKun/ath-monitor.git
cd ath-monitor\Agent
npm install
npm run build:win

# 2. The native addon must be present, and must be the win32 one.
#    If this prints nothing, the build is broken — see below.
Get-ChildItem -Path dist\win-unpacked -Recurse -Filter *.node |
    Select-Object -ExpandProperty FullName

# 3. The installer should carry real version metadata, not blanks.
(Get-Item "dist\ATH Monitor Agent Setup 0.1.0.exe").VersionInfo |
    Format-List ProductName, CompanyName, FileDescription, FileVersion

# 4. Size sanity check — expect roughly 90-100 MB.
(Get-Item "dist\ATH Monitor Agent Setup 0.1.0.exe").Length / 1MB
```

**What good looks like**

| Step | Expected |
|---|---|
| 2 | At least one path containing `napi-9-win32-unknown-x64\node-get-windows.node` |
| 3 | `ATH Monitor Agent` / `ATH Gadlang` / a real version — not empty |
| 4 | ~96 MB |

Step 2 is the one that matters. A missing win32 addon does not fail the build,
does not error at runtime, and produces an agent that tracks time and takes
screenshots perfectly while reporting **no application names at all**. If it
prints nothing, run `npm run fetch:win-native` and rebuild.

Building *on* Windows normally makes this a non-issue — `npm install` fetches
the right binary for the machine it runs on. The check exists because installers
are often cross-built from a Mac, where it is not automatic.

**Then actually run it** — packaging correctly is not the same as working:

1. Run the installer. Expect "Windows protected your PC" → **More info** →
   **Run anyway**. No admin password needed.
2. Sign in with an **employee** account (admins have no `employee_id`).
3. Press **Start**, work for two or three minutes, press **Stop**.
4. Plug a USB stick in and pull it out while the timer is running.
5. In the portal, check:
   - the employee's profile shows **application names**, not just hours —
     this is what proves step 2 worked;
   - **DLP → USB Detection** lists the connect and disconnect.

Report back: whether app names appeared, whether the USB events appeared, and
anything Defender said.

---

## Why cross-building works

The only native dependency is `get-windows`, which reads the focused window's
title. It publishes **prebuilt** binaries per platform, so nothing needs
compiling — the Windows binary just needs downloading. Two pieces of config
make that happen:

**`scripts/fetch-win-native.mjs`** downloads the win32 addon into the path
`node-pre-gyp` looks in. A plain `npm install` only ever fetches the addon for
the machine you are standing on.

This step is not optional, and the failure is silent by design of the upstream
library: when the binding is missing, `preGyp.find()` falls back to a **no-op
stub** rather than throwing. The app runs fine and quietly reports nothing.
That is why `build:win` runs the script for you and why the verification step
above exists.

**`npmRebuild: false`** in `electron-builder.yml` stops electron-builder
handing the addon to `@electron/rebuild` → `node-gyp`, which refuses to
cross-compile and kills the build with *"node-gyp does not support
cross-compiling native modules from source"*. Nothing needs rebuilding: N-API
is stable across Node and Electron versions.

---

## 5. Test it before sending it anywhere

Cross-building produces a correct artifact. It does not prove the thing runs.
Do this once per release on a real Windows machine — any spare laptop or VM:

1. Copy the installer over and run it. Expect the SmartScreen warning; click
   **More info → Run anyway**.
2. It installs per-user: no admin password, no UAC prompt.
3. Sign in with an **employee** account. Admin accounts have no `employee_id`
   and their uploads have nowhere to go.
4. Press **Start**, work for a couple of minutes, press **Stop**.
5. In the portal, open that employee's profile and confirm **application names
   appear**, not just hours. That is the check that catches a missing native
   addon.

---

## 6. Distributing it

The installer is not committed to the repository — `dist/` is gitignored, and
a 96 MB binary does not belong in git.

**After the first install, you do not distribute builds by hand at all.** The
agent auto-updates from `https://workpulse.athgadlang.com/updates/`; a release is
a git tag, and machines pick it up on their own. Cutting one:

```bash
cd Agent
npm version patch          # bumps package.json AND creates the agent-v tag
git push origin main --follow-tags
```

Run it from `Agent/`, not the repo root — `Agent/.npmrc` sets
`tag-version-prefix=agent-v`, and that is what makes the tag match the
workflow's trigger. npm's default prefix is a bare `v`, which matches nothing;
the version would move and no release would run.

That fires [`.github/workflows/release-agent.yml`](../.github/workflows/release-agent.yml),
which builds on a Windows runner, uploads the installer to the VPS, and then
verifies the feed actually serves what it just published.

Two things that will bite if ignored:

- **The version must be bumped.** electron-updater compares the feed's version
  against the installed one. A release that reuses a version is invisible to the
  fleet and silently does nothing. `npm version` handles this; hand-editing the
  tag does not, and the workflow fails the build rather than shipping a release
  nobody will receive.
- **Updates apply at the next launch, not immediately.** The download happens
  quietly during the session; the install happens when the agent next starts. On
  machines where the timer follows the Windows session, that means the next
  login. This is deliberate — see the header of `src/main/updater.js` for why
  installing at quit does not work on Windows.

### First install: send this link

```
https://workpulse.athgadlang.com/updates/agent-setup.exe
```

That is a symlink the release workflow repoints at each new build, so the link
never changes and you can reuse it. Send the link, not the file — the installer
is ~96 MB and will bounce off most mail servers.

`/updates/` has `autoindex` off, so nobody can browse the directory to find a
build themselves; this stable name is the only discoverable entry point.

**Upgrading from a pre-TLS build needs no uninstall.** The installer upgrades in
place and keeps the agent's stored settings — including the old
`http://<ip>` server URL, which takes precedence over the new default. The agent
rewrites that on first launch (`migrateLegacyServerUrl` in `src/main/config.js`),
so an in-place upgrade lands on the domain by itself.

For a machine that has fallen too far behind to update, hand over the `.exe`
directly:

```bash
gh release create v0.1.0 "dist/ATH Monitor Agent Setup 0.1.0.exe" \
   --title "ATH Monitor Agent 0.1.0" \
   --notes "First pilot build."
```

### What to tell employees

Include this with the link, or the first support question will be "my antivirus
blocked it":

> Windows will show **"Windows protected your PC"** the first time you run
> this. That is expected — it appears for any new program that has not yet
> built up a download reputation. Click **More info**, then **Run anyway**.
>
> You do not need an administrator password.

---

## The signing situation

**The agent ships unsigned.** That is a deliberate decision, recorded in
[`../BACKLOG.md`](../BACKLOG.md) under Phase 2: for a ten-person pilot on
laptops that are not centrally managed, a certificate was not judged worth the
cost and lead time.

Two consequences, one cosmetic and one not:

**SmartScreen** shows the warning above. Dismissible, harmless, annoying.

**Windows Defender** is the real risk. An unsigned program that takes
screenshots, starts automatically and sends data to a server matches spyware
heuristics closely. A quarantine is *silent* and can happen days later after a
definition update — the agent simply stops reporting and nobody is told.

Do these, in order of value:

1. **Submit each new build to Microsoft as a false positive** at
   <https://www.microsoft.com/wdsi/filesubmission>. Free, a few days'
   turnaround, and by far the most effective thing available without a
   certificate.
2. Add a per-machine Defender exclusion during install.
3. **Never add a packer or obfuscator to the build.** UPX and similar are the
   single biggest cause of antivirus false positives. `electron-builder.yml`
   carries a comment saying so — please leave it there.

Revisit the certificate decision if agents start going quiet, or before rolling
out past roughly 50 machines. Hand-holding hundreds of people through
SmartScreen prompts and manual antivirus exclusions does not scale.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `node-gyp does not support cross-compiling` | `npmRebuild` was re-enabled | Restore `npmRebuild: false` in `electron-builder.yml` |
| Installer builds, but no app names in the portal | Windows native addon missing | Run `npm run fetch:win-native`, rebuild, and re-run the `find` check above |
| `Cannot read properties of undefined (reading 'requestSingleInstanceLock')` | `ELECTRON_RUN_AS_NODE` is set in your shell | `env -u ELECTRON_RUN_AS_NODE npm start`. Some IDE terminals set it |
| Agent runs but cannot reach the server | `DEFAULT_SERVER_URL` is internal or wrong | Use the address a browser would use; override on the sign-in screen to test |
| Build fails downloading Electron | Offline or proxied network | First build needs internet; set `ELECTRON_MIRROR` behind a proxy |
| macOS dev build: no window titles | Accessibility permission not granted | System Settings → Privacy & Security → Accessibility. Windows needs no equivalent |
