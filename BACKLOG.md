# ATH Monitor — Prioritised Backlog

Status of everything known outstanding, ordered so each phase unblocks the next.
Nothing below is started unless marked otherwise.

New here? Read [`README.md`](README.md) first for what the system is and how to
run it. This file is the answer to "what should I do next".

**Legend** — 🔴 blocking · 🟡 important · 🟢 nice to have · ⏱️ long lead time

---

## Phase 0 — Unblock the Docker stack
*Three pre-existing dependency bugs that a clean container exposed. They are not
Docker problems — they would break any clean production deploy. Nothing else can
ship until these are fixed.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| 0.1 | **`desktop`: missing `newrelic`** | 🔴 | 15 min | `desktopApi.js:2` requires it but it's absent from `package.json`. Works locally only because it's stale in `node_modules`. Either add it as a dependency or remove the require. |
| 0.2 | **`store-logs-api`: `@nestjs/swagger` in devDependencies** | 🔴 | 15 min | Imported at runtime by `app.controller.js`; `--omit=dev` strips it. Move to `dependencies`. |
| 0.3 | **`cronjobs`: empty `SMTP_URL` crashes boot** | 🔴 | 30 min | `nodemailer.createTransport('')` throws `Cannot create property 'mailer' on string ''`. Guard for empty/missing value. **Blocks screenshot retention** — the pruning cron lives in this service. |
| 0.4 | Verify full stack end-to-end in Docker | 🔴 | 1 h | All 13 services healthy; log in and load a real page through nginx on :8090. |

**Current state:** 10 of 13 services up. Images all build cleanly (9/9).

---

## Phase 1 — Pilot environment (Hostinger KVM 2)
*Blocked on: your Hostinger SSH credentials and a subdomain. Nothing else.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| 1.1 | Provision the VPS + Docker | 🔴 | 1 h | Hostinger KVM 2 (~$8/mo) was chosen over Azure B2ms. See `DEPLOY.md`. |
| 1.2 | Deploy stack, DNS + TLS | 🔴 | 2–3 h | Let's Encrypt via nginx. |
| 1.3 | **Set retention to 40 days** | 🟡 | 2 min | Settings → Storage Types → "Delete Data Older Than (Days)" = `40`. Config only, no code. |
| 1.4 | Smoke test with 2–3 accounts | 🟡 | 1 h | Signup → admit → login → timer. |
| 1.5 | Remove the `AUTH_METHOD_V3` login bypass | 🔴 | 15 min | Any password matching `ADMIN_PASSWORD` logs in as the baked-in org. **Never leave enabled on a public host.** |

---

## Phase 2 — Desktop agent ⏱️ *the critical path*
*The longest item and the one nothing else can substitute for. The existing Qt
source is not in this repo, so this is a fresh build. The backend needs no changes —
the API contract is fully documented in the DTOs.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| ~~2.0~~ | ~~Buy code-signing certificates~~ | — | — | **DECIDED: no certificate for the pilot.** Windows-only fleet, so the $99 Apple fee never applied. Laptops are *not* centrally managed, so the free Group-Policy route isn't available either — but for 10 users an unsigned install is workable. See 2.0a. Revisit before scaling past ~50 users. |
| 2.0a | **Submit the binary to Microsoft as a false positive** | 🟡 | 30 min + few days | Free, at microsoft.com/wdsi/filesubmission. Do this as soon as the first build exists — it is the single most effective unsigned mitigation, and the turnaround is days. |
| 2.0b | Document the SmartScreen bypass for pilot users | 🟡 | 15 min | "More info → Run anyway". Ship it with the install instructions so nobody assumes the app is malware. |
| ~~2.1~~ | ~~Electron v1: login, timer, screenshots, idle, active app + window title~~ | ✅ | done | Built in `Agent/`. Verified end-to-end against the Docker stack: login, 5-min flush, screenshots to MinIO, clock-in upsert, app + window titles. See `Agent/README.md`. |
| 2.2 | v2: auto-update and auto-start on boot | 🔴 | 1 wk | The **offline queue shipped early in v1** — it was cheap and a wifi drop otherwise loses a whole afternoon. **Per-key/click counts dropped from scope:** typing and mouse already both count as activity, and distinguishing them was confirmed unnecessary, so `uiohook-napi` — a native dependency that would complicate the cross-build and add antivirus surface — is not worth adding. Remaining: `electron-updater`, launch-on-login. **Raised to blocking if punctuality reporting is used:** check-in time is when the user presses Start, so somebody who begins work on time but opens the app ten minutes later is recorded as ten minutes late. Attendance already computes and stores lateness (see 5.1), which makes launch-on-login a fairness issue rather than a convenience. |
| 2.3 | v3: browser extension for URLs | 🟢 | 1–2 wks | Without it you get "Chrome: 3h", not "Jira 2h / YouTube 1h". |
| 2.4 | Repoint the "Download Agent" button at your own installer | 🟡 | 2 h | Endpoint and UI already exist; it currently serves a Qt binary you don't control. Now unblocked — 2.1 produces the installer. |
| ~~2.5~~ | ~~Build the Windows installer on a Windows machine~~ | ✅ | done | **Not needed — it cross-builds from macOS/Linux.** `get-windows` publishes *prebuilt* Windows addons, so `scripts/fetch-win-native.mjs` just downloads one; `npmRebuild: false` stops node-gyp trying to compile it. Verified: a 96 MB NSIS installer with correct PE metadata, built on an Apple Silicon Mac. No VM, no Wine. |
| 2.6 | Smoke-test the Windows build on a real Windows machine | 🔴 | 30 min | "It packaged" ≠ "it runs". One pass: install, sign in, start timer, confirm app names reach the portal — that last step is what catches a missing native addon. **Also plug a USB stick in and pull it out**, then check DLP → USB Detection: the Windows enumeration path (`Win32_DiskDrive`) has only been tested against synthetic data. Any spare laptop or VM. |
| 2.7 | Add an application icon | 🟢 | 30 min | Currently ships the stock Electron icon (`build/icon.ico`, 256×256). Minor, but a generic icon on an unsigned autostarting app is one more reason for a user to distrust it. |
| ~~2.8~~ | ~~Report *visible* windows, not just the focused one~~ | ✅ | done | Closes the dual-monitor gap. Background windows are sampled once a minute and reported as system-log **type 11** — evidence, not time — and surfaced under **DLP → Second Screen Activity**. Only windows on a display that does not hold the focused window count, so single-monitor machines report nothing (occlusion is unknowable; guessing would be worse). Backend needed no changes. |
| 2.9 | Alert rule on second-screen activity | 🟢 | 1 d | The data now exists but nobody is told about it — someone has to open the report. The alert engine in `admin/src/jobs/alertsAndNotifications` could raise one when a given app appears on a second screen for over N minutes. |
| ~~2.10~~ | ~~USB storage detection~~ | ✅ | done | Reported as system-log types **2** (connected) and **3** (disconnected), surfaced on the existing USB Detection page. Detects *disks* on a USB interface rather than USB devices generally, so a mouse, monitor, headset or keyboard cannot be flagged — there is no device-class heuristic to get wrong. Types 2–5 were undocumented anywhere upstream; 2 and 3 are now defined in `Agent/src/main/tracker/index.js`, 4 and 5 left unclaimed. |

**Deliberately out of scope:** keystroke *content* capture. It's a keylogger —
captures passwords, triggers antivirus, carries real legal exposure. Productive time
doesn't need it, and `DISABLE_KEYSTROKE_FEATURE` already exists.

---

## Phase 5 — Attendance and punctuality (already built, needs configuring)

*No code required. `TimeCalculator` already marks each day Present / Absent /
Half-day / Late / Overtime / Early-logout with durations, and the Attendance
page renders it as a monthly grid with Excel export.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| 5.1 | Define shifts and assign employees | 🟡 | 1 h | Settings → Shift Management. Per-day start/end, `late_period` grace (10 min default), half-day threshold, overtime threshold, early-logout allowance. Shifts can be scoped per location. Employees carry a `shift_id`; without one they are treated as having no fixed hours and nothing is marked late. |
| 5.2 | Decide the grace period with whoever owns the policy | 🟡 | — | The default is 10 minutes. This is a people decision, not a technical one, and it should be agreed before anyone sees a report about themselves. |
| 5.3 | Turn on agent auto-start before reporting on punctuality | 🔴 | — | See 2.2. Measuring lateness against a manually-launched app penalises people for the tool's behaviour rather than their own. |

---

## Phase 3 — Known bugs from the audit
*Found while mapping the app. None block the pilot.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| 3.1 | `addDefaultStorageToFreePlan` malformed SQL | 🟡 | 30 min | Throws `ER_PARSE_ERROR` whenever an org is created on the free plan (`product_id` = `FREE_PLAN_ID`). Worked around by using `product_id: 99`. |
| 3.2 | Orphaned pages with no menu link | 🟢 | 1 h | Reseller Dashboard, Reseller Settings, Addon Features — all work, reachable only by typing the URL. |
| 3.3 | Delete 4 dead router files | 🟢 | 15 min | `src/router/{admin,nonadmin,employee,default}.routes.jsx` — never imported; one contradicts the live redirect target. |
| 3.4 | `package-lock.json` drift across 6 services | 🟡 | 1 h | Lockfiles are out of sync with their `package.json` (e.g. `admin` declares `cors` + `file-stream-rotator`, drops `mysql`). Related to 0.1/0.2. |
| ~~3.6~~ | ~~Admitted employees got a NULL `employees.timezone`~~ | ✅ | done | Found while testing the agent. Mongo rejects activity documents without a timezone, so an admitted user could log in fine and then have **every** upload fail with `Path 'timezone' is required`. `admitPendingSignups` now inherits the organisation's zone (and accepts an override); `userAuth` also falls back rather than passing null on. |
| 3.7 | An organisation with no storage integration silently breaks screenshots | 🟡 | 2 h | Uploads return `Failed to retrieve cloud integration data`. Nothing in the admin UI warns that a new org has no storage configured — it only surfaces once an agent is running. Worth a setup check on the Storage page. |
| 3.8 | Employee profile shows "Employee not found" on direct URL / refresh | 🟡 | 1 h | `/admin/get-employee-details?id=1` renders fine when clicked from the employee list but fails on reload, bookmark or shared link — the page reads router state instead of the `id` query param it already carries. |
| 3.9 | Nothing categorises apps, so productive time is always 0% | 🟡 | 2 h | Config, not code: with no productivity ranking set, all tracked time lands in **Neutral** and the dashboard reads `Productive 00:00:00 (0.00%)`. The 8-hour productive-time target is meaningless until Settings → Productivity is populated with the apps people actually use (Excel, Outlook, the LOB tools). Do this before the pilot or the reports will look broken. **Good news:** the list populates itself — every app and domain the agent reports is auto-registered as Neutral, so the admin only has to classify what actually shows up rather than guess in advance. |
| 3.10 | Confirm re-categorising an app re-scores *existing* data | 🔴 | 2 h | Marking apps Productive saved correctly (`organization_department_apps_webs.status = 1`) but the dashboard still read `Productive 0.00%` minutes later. The dashboard reads pre-aggregated `employee_productivity_reports`, built by the event-driven `productivity_report` worker — so the open question is whether re-classifying triggers a recompute of past days or only affects new activity. **This matters for the pilot:** if it is forward-only, the apps must be classified *before* people start tracking, or week one's numbers are permanently wrong. |
| 3.5 | Close PR #291 | 🟢 | 2 min | **Your action** — targets the upstream EmpCloud repo. Code is already merged into your fork's `main`. |

---

## Phase 4 — Production hardening
*Only needed approaching 300–500 users. Roughly 2–4 weeks total.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| 4.1 | `realtime` hardcodes `numCPUs = 2` | 🟡 | 15 min | Won't use a bigger VM. The "use all cores" line is commented out. |
| 4.2 | Add `/health` endpoints to all services | 🟡 | 3 h | A load balancer currently has nothing reliable to probe. |
| 4.3 | Redis backplane for `web-socket-server` + `remote_socket` | 🟡 | 1 wk | Needed before running multiple instances. `realtime` already has one. |
| 4.4 | Load test with simulated agents | 🔴 | 1 wk | This codebase has never run at 500 users. Do this before committing to reserved instances. |
| 4.5 | Move secrets to Azure Key Vault | 🟡 | 1 d | Currently plain env vars. |
| 4.6 | Managed MySQL + separate Mongo VM | 🟡 | 1 d | Single-VM stack won't hold 500 users. |
| 4.7 | Confirm monitoring disclosure/consent obligations | 🔴 | — | Legal requirement in many jurisdictions (GDPR, several US states). Check before a 500-person rollout. |

---

## Decided — no action needed

- **Screenshot frequency → 9/hour** (~1 per 7 min). Done: `default.settings.json`
  plus two hardcoded fallbacks, and the existing org row.
- **40-day retention.** Already implemented; needs configuring (1.3), not building.
- **No Azure Blob driver.** Retention caps storage at ~154 GB, so the saving
  (~$16/mo) doesn't justify 2–3 days of work. Use MinIO.
- **Web app instead of a desktop agent — ruled out.** Employees use Excel and other
  desktop apps; a browser cannot see outside itself.
- **Idle threshold → 5 minutes, judged per continuous run.** A 4-minute pause is
  deducted not at all; a 7-minute pause is deducted in full, not just the 2
  minutes past the line. Three defaults disagreed (10 / 10 / 2) and are now
  reconciled, and the agent reads the value from the org setting rather than a
  constant.
- **Background windows are evidence, not time.** They deliberately do not enter
  `appUsage`: those entries carry a start and end that the reporting side sums,
  so two windows claiming the same minute would inflate the productive-hours
  figure the system exists to produce.
- **Keystroke *content* capture — permanently out of scope.** It is a keylogger.
- **Typing and mouse both count as activity, and are not distinguished.**
  `getSystemIdleTime()` resets on any human input, so neither is favoured.
  Reporting *which* it was would need a low-level input hook (2.2) and nothing
  requires it.
- **English only.** The other five locales are removed from the picker, and a
  language saved against an older organisation is ignored rather than applied —
  otherwise an org set to `ar` would land users in a right-to-left UI with no
  way back. Bundles and the loader remain; restoring one is two lines.
- **Features with no data source are hidden, not deleted.** Live screen
  viewing, screen recording, webcam capture, clipboard logs, email activity
  logs, and the Screen Cast / Screen Recording / Key Strokes profile tabs came
  from upstream's Qt agent. Ours collects none of it, so the pages could only
  ever be empty. Routes and components are intact and commented — re-enabling
  one is a single line. Key Strokes is the exception: permanently out, see above.

---

## Critical path

```
Phase 0 ✅ done  →  Phase 1 (1 day, needs VPS)  →  pilot platform running
Phase 2.1 ✅ done ↗
```

Both long poles are down. **The only thing blocking a pilot now is the VPS** —
credentials for Hostinger KVM 2 plus a subdomain, and Phase 1 is about a day's
work. The agent already runs against the stack and produces real data.

Two things should happen before employees start tracking, neither of which
needs the server:

1. **Classify the applications** (3.9). Until then every hour is Neutral and
   the dashboard reads `Productive 0.00%`, which looks like a broken product.
   The list populates itself from real agent data, so this is a short task —
   but it needs someone who knows which tools count as work.
2. **Settle 3.10** — whether classifying an app re-scores days already
   recorded. If it is forward-only, step 1 becomes a hard prerequisite rather
   than a nicety.

Verified end-to-end on the local Docker stack (27–28 Jul 2026): sign in,
5-minute activity flush, screenshots to MinIO at ~95–190 KB each, clock-in
upsert extending a single timesheet row, app + window titles in Mongo, and the
portal rendering all of it — dashboard, employee profile, screenshot gallery
and Second Screen Activity. The offline queue was tested by stopping
`store-logs-api` mid-session: 7 items queued, all delivered after recovery,
with screenshots still filed under their capture time rather than their upload
time.

**The risk being carried instead:** on unmanaged Windows machines an unsigned app
that screenshots, autostarts and phones home matches Defender's spyware heuristics.
SmartScreen is only an annoyance (dismissible), but a Defender quarantine is silent
and can strike days later after a definition update — the agent simply stops
reporting and nobody knows why. Mitigations: 2.0a (false-positive submission),
per-machine Defender exclusion during install, and **never pack or obfuscate the
binary** — packers are the single biggest driver of AV false positives.

Revisit the certificate decision if agents start going silent, or before rolling
out beyond ~50 machines — hand-holding 500 people through SmartScreen and manual
antivirus exclusions does not scale.
