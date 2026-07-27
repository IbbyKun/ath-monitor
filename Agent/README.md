# ATH Monitor Agent

The desktop time-tracking agent. Employees sign in, press **Start**, and the
agent records worked time, periodic screenshots, and which applications were in
use — then uploads all of it to the ATH Monitor backend, where it shows up on
the web portal.

This replaces the Qt agent that the upstream EmpMonitor project ships but whose
source is not in this repository. It is built on Electron so it can be
maintained by the same team that maintains the web app.

---

## What it does (v1)

| Capability | How |
|---|---|
| Manual start/stop timer | Hubstaff-style. Nothing is recorded until the user presses Start. |
| Worked vs. idle time | `powerMonitor.getSystemIdleTime()`, sampled once a second. |
| Periodic screenshots | Electron `desktopCapturer`, all monitors, ~9/hour by default. |
| Active application + window title | `get-windows`. Covers Excel and other desktop apps, not just browsers. |
| Survives going offline | Failed uploads are written to disk and retried. |
| Runs in the background | Closing the window hides it to the tray; the timer keeps running. |

**Not in v1** — these are tracked in [`../BACKLOG.md`](../BACKLOG.md) as 2.2 and 2.3:

- Per-key/click counts (needs `uiohook-napi`). The activity signal today is
  active-vs-idle per second, which is enough for a productivity percentage but
  cannot distinguish typing from clicking.
- Auto-update and auto-start on boot.
- Browser URLs. Without the extension you get `Chrome — <tab title>`, not the
  URL. Window titles still make most tabs identifiable.

Keystroke **content** capture is deliberately out of scope permanently. It is a
keylogger: it captures passwords, guarantees antivirus problems, and carries
real legal exposure. Productive-time reporting does not need it.

---

## Running it in development

```bash
cd Agent
npm install
AGENT_SERVER_URL=http://localhost:8090 npm start
```

`AGENT_SERVER_URL` overrides the saved server address. You can also set it from
the **Server settings** section on the sign-in screen, which is what pilot users
will do.

Sign in with any **employee** account (not an admin account — admins have no
`employee_id`, so their uploads have nowhere to go).

### macOS permissions

The pilot fleet is Windows, where nothing needs granting. On macOS, for local
development, the agent needs two permissions and will tell you which is missing:

- **Screen Recording** — for screenshots.
- **Accessibility** — for `get-windows` to read window titles.

Both are under *System Settings › Privacy & Security*. In development you grant
them to **Electron**, not to the agent.

---

## Building the installer

```bash
npm run build:win     # dist/ATH Monitor Agent Setup <version>.exe
```

> **Build the Windows installer on Windows.** `get-windows` ships a native
> N-API addon that `npm install` fetches per-platform. Running `npm install` on
> macOS downloads the macOS binary, so a Windows installer cross-built from a
> Mac will start up and then silently report no application data. There is no
> error — just empty app-usage columns in the portal.

The installer is a per-user NSIS install: no admin rights, no UAC prompt.

### It is unsigned, on purpose

See *Phase 2 — DECIDED: no certificate* in [`../BACKLOG.md`](../BACKLOG.md).
For a 10-person pilot on unmanaged laptops the certificate cost is not yet
justified. Two consequences:

1. **SmartScreen** shows "Windows protected your PC" on first run. Users click
   **More info → Run anyway**. Annoying, dismissible, harmless.
2. **Defender** is the real risk. An unsigned app that screenshots, autostarts
   and phones home matches spyware heuristics, and a quarantine is *silent* —
   it can happen days later after a definition update, and the agent just stops
   reporting.

Mitigations, in order of value:

- Submit each new build to <https://www.microsoft.com/wdsi/filesubmission> as a
  false positive. Free, a few days' turnaround, and by far the most effective
  thing available without a certificate.
- Add a per-machine Defender exclusion during install.
- **Never add a packer or obfuscator** to the build. UPX and friends are the
  single biggest driver of antivirus false positives. `electron-builder.yml`
  has a comment to this effect — please leave it there.

Revisit the certificate decision if agents start going silent, or before
rolling out past ~50 machines.

---

## How it talks to the backend

Everything goes through the nginx in front of the stack, which splits by path
prefix, so the agent only ever needs one base URL.

| Purpose | Request |
|---|---|
| Sign in | `POST /api/v3/auth/user` → `{ data: <token>, user_id: <employee_id>, … }` |
| Screenshot frequency | `GET /api/v1/desktop/feature-status` |
| Activity batch | `POST /api/v1/desktop/add-activity-log` |
| Screenshots | `POST /api/v1/desktop/upload-screenshots` (multipart) |
| Clock in/out | `POST /api/v1/timesheet/record-clock-in` |

All but the first take `Authorization: Bearer <token>`.

Three details in that contract are easy to get wrong and worth knowing about
before changing anything:

1. **Screenshot filenames are parsed by offset.** The storage layer does
   `originalname.substr(3, 10)` to get the date, so the name *must* be
   `HH-YYYY-MM-DD HH-mm-ss-scN.jpg`. A "tidier" filename silently files every
   screenshot under the wrong date.
2. **`activityPerSecond` arrays are capped at 400 entries** by the server's Joi
   schema. That is why the flush interval is 300 seconds and cannot simply be
   raised.
3. **Clock records upsert** on `(attendance, start_time, type, mode)`. Sending
   the same `startDate` with a later `endDate` extends the existing span rather
   than creating a duplicate — which is what makes the every-flush heartbeat
   safe, and means a crash loses one interval instead of a whole session.

### Requirements on the account

An employee can only upload if their `employees.timezone` is set — Mongo
rejects activity documents without it. Accounts created through the admin UI or
the pending-signup admission flow get this automatically.

### Storage

Screenshots go wherever the organisation's storage integration points. For the
Docker stack that is MinIO via the S3 driver. An organisation with **no**
integration configured gets `Failed to retrieve cloud integration data` on every
upload — the agent surfaces this rather than discarding the screenshot, and
retries it from the queue.

Retention is `organization_provider_credentials.auto_delete_period`, in days —
40 for this deployment. It is enforced by a nightly cron in the `cronjobs`
service, not by the agent.

---

## Where things live

```
src/
  main/
    index.js              app lifecycle, tray, IPC, window
    api.js                HTTP client for the five endpoints above
    config.js             tracking constants + server URL
    store.js              small JSON persistence
    session.js            token storage, encrypted via OS keychain/DPAPI
    queue.js              disk-backed retry queue
    tracker/
      index.js            the sampling + flush loop
      screenshots.js      desktopCapturer + the filename format
      active-window.js    get-windows wrapper, degrades if unavailable
  preload/index.js        contextBridge — the only renderer↔main surface
  renderer/               login + timer UI
```

Local state lives in Electron's `userData` directory:
`agent-config.json` (server URL, encrypted token) and `queue/` (undelivered
uploads).
