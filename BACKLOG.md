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

## Phase 1 — Azure test environment
*Blocked on: Phase 0, plus your Azure credentials.*

| # | Item | Pri | Est. | Notes |
|---|---|---|---|---|
| 1.1 | Provision B2ms VM + Docker | 🔴 | 1 h | ~$20–25 for a one-week pilot. See `DEPLOY.md`. |
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
| 2.0 | **Buy code-signing certificates** | 🔴⏱️ | 1–2 wks lead | **Start immediately — this is pure waiting time.** Windows OV ~$200–400/yr (EV ~$500 skips SmartScreen); Apple Developer $99/yr. Unsigned builds are blocked by Gatekeeper and flagged by SmartScreen. |
| 2.1 | Electron v1: login, timer, screenshots, idle, active app + window title | 🔴 | 2–3 wks | Enough to compute real productive time for desktop apps (Excel etc.). |
| 2.2 | v2: mouse/keyboard counts, **offline queue**, auto-update, auto-start on boot | 🟡 | 1–2 wks | Don't skip the offline queue — a wifi drop otherwise loses a whole afternoon. |
| 2.3 | v3: browser extension for URLs | 🟢 | 1–2 wks | Without it you get "Chrome: 3h", not "Jira 2h / YouTube 1h". |
| 2.4 | Repoint the "Download Agent" button at your own installer | 🟡 | 2 h | Endpoint and UI already exist; it currently serves a Qt binary you don't control. |

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
Phase 0 (1 day)  →  Phase 1 (1 day)  →  pilot running
                 ↘
                   Phase 2.0 certs (start NOW, 1–2 wks waiting)
                   Phase 2.1 agent v1 (2–3 wks)  →  real monitoring data
```

**Start the certificate purchase today** — it's the only item where waiting can't be
compressed, and it gates the agent rollout regardless of when the code is finished.
