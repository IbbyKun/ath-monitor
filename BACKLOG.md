# EmpMonitor — Prioritised Backlog

Status of everything known outstanding, ordered so each phase unblocks the next.
Nothing below is started unless marked otherwise.

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
| 2.2 | v2: mouse/keyboard counts, auto-update, auto-start on boot | 🟡 | 1–2 wks | The **offline queue shipped early in v1** — it was cheap and a wifi drop otherwise loses a whole afternoon. Remaining: per-key/click counts (`uiohook-napi`), `electron-updater`, launch-on-login. |
| 2.3 | v3: browser extension for URLs | 🟢 | 1–2 wks | Without it you get "Chrome: 3h", not "Jira 2h / YouTube 1h". |
| 2.4 | Repoint the "Download Agent" button at your own installer | 🟡 | 2 h | Endpoint and UI already exist; it currently serves a Qt binary you don't control. Now unblocked — 2.1 produces the installer. |
| ~~2.5~~ | ~~Build the Windows installer on a Windows machine~~ | ✅ | done | **Not needed — it cross-builds from macOS/Linux.** `get-windows` publishes *prebuilt* Windows addons, so `scripts/fetch-win-native.mjs` just downloads one; `npmRebuild: false` stops node-gyp trying to compile it. Verified: a 96 MB NSIS installer with correct PE metadata, built on an Apple Silicon Mac. No VM, no Wine. |
| 2.6 | Smoke-test the Windows build on a real Windows machine | 🔴 | 30 min | "It packaged" ≠ "it runs". One pass: install, sign in, start timer, confirm app names reach the portal. Any spare laptop or VM. |
| 2.7 | Add an application icon | 🟢 | 30 min | Currently ships the stock Electron icon (`build/icon.ico`, 256×256). Minor, but a generic icon on an unsigned autostarting app is one more reason for a user to distrust it. |

**Deliberately out of scope:** keystroke *content* capture. It's a keylogger —
captures passwords, triggers antivirus, carries real legal exposure. Productive time
doesn't need it, and `DISABLE_KEYSTROKE_FEATURE` already exists.

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

---

## Critical path

```
Phase 0 ✅ done  →  Phase 1 (1 day, needs VPS)  →  pilot platform running
Phase 2.1 ✅ done ↗
```

Both long poles are down. **The only thing blocking a pilot now is the VPS** —
credentials for Hostinger KVM 2 plus a subdomain, and Phase 1 is about a day's
work. The agent already runs against the stack and produces real data.

Verified end-to-end on the local Docker stack (27 Jul 2026): sign in, 5-minute
activity flush, screenshots to MinIO at ~95 KB each, clock-in upsert extending a
single timesheet row, and app + window titles landing in Mongo. The offline
queue was tested by stopping `store-logs-api` mid-session — 7 items queued,
all delivered after recovery, with screenshots still filed under their capture
time rather than their upload time.

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
