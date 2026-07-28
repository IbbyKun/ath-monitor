# ATH Monitor

An in-house employee time-tracking and productivity platform: a web portal plus
a desktop agent that records worked time, periodic screenshots and application
usage.

Forked from [EmpCloud/EmpMonitor](https://github.com/EmpCloud/EmpMonitor) and
adapted for ATH Gadlang. Licensed AGPL-3.0, as upstream is.

> **New here — human or agent? Read this file, then [`BACKLOG.md`](BACKLOG.md).**
> Between them they describe what exists, what works, what is deliberately
> unfinished, and what to do next. Everything else is detail.

---

## Documentation map

| File | What it covers |
|---|---|
| **`README.md`** (this file) | What the system is, how it fits together, how to run it |
| **[`FEATURES.md`](FEATURES.md)** | Every feature in plain English, with what's ready, what needs setting up and what's turned off. **Start here if you are not a developer** |
| **[`BACKLOG.md`](BACKLOG.md)** | Prioritised work, phase by phase. **The source of truth for what to do next.** Includes known bugs and decisions already made, with reasoning |
| **[`DEPLOY.md`](DEPLOY.md)** | Hosting, sizing, cost, storage maths, and the deployment traps that cost real time |
| **[`Agent/README.md`](Agent/README.md)** | The desktop agent: what it records, how to build it, and the three parts of the API contract that are easy to get wrong |
| `Backend/*/README.md` | Per-service notes inherited from upstream. Broadly accurate about endpoints; **ignore their install instructions**, which predate Docker |
| `Backend/Installation.md`, `Backend/Readme.md` | Upstream pm2-based setup. Superseded by Docker — see below |
| `QT/Readme.md` | Describes upstream's Qt agent. **That source is not in this repository.** See `Agent/` instead |

---

## What this actually is

Three moving parts:

1. **Web portal** — React 19 + Vite, served by nginx. Admins manage employees,
   review screenshots and timesheets, and classify applications as productive
   or not. Employees see their own data.
2. **Backend** — nine Node.js services (one NestJS) behind that same nginx,
   over MySQL, MongoDB and Redis, with MinIO for screenshot storage.
3. **Desktop agent** — Electron, in [`Agent/`](Agent/). Employees sign in, press
   Start, and it reports worked time, screenshots and app usage.

The agent is **ours**. Upstream ships a Qt agent whose source was never
published, so `Agent/` is a fresh build against the same backend API — which
needed no changes, because the contract was already fully specified by the
store-logs-api DTOs and Joi schemas.

### How data flows

```
Desktop agent ──► nginx ──► store-logs-api ──► MongoDB   (activity, app usage)
      │                          └──────────► MinIO     (screenshots)
      │                          └──────────► MySQL     (clock in/out)
      │
      └── signs in via ──► admin service ──► MySQL + Redis session
                                  ▲
Web portal ──► nginx ─────────────┘
```

nginx splits by path prefix, so both the browser and the agent only ever need
one base URL:

| Prefix | Service |
|---|---|
| `/api/v3/…` | admin (login, all portal APIs) |
| `/api/v1/auth/…` | admin |
| `/api/v1/…` | store-logs-api (all agent uploads) |
| `/notification/`, `/rt/` | web-socket-server, realtime |
| everything else | the SPA |

---

## Running it

### The whole stack, locally

```bash
cp .env.docker.example .env     # then fill in the placeholders
docker compose --profile setup up migrations   # first run only — loads the schema
docker compose up -d --build
```

The portal comes up on **http://localhost:8090**. 13 containers; give the first
build ten minutes or so.

`migrations` sits behind a profile on purpose: `emp-monitor.sql` is **not**
idempotent, so re-running it against a populated database will fail.

### The desktop agent

```bash
cd Agent
npm install
AGENT_SERVER_URL=http://localhost:8090 npm start
```

Sign in with an **employee** account. Admin accounts have no `employee_id`, so
their uploads have nowhere to go.

See [`Agent/README.md`](Agent/README.md) for building the Windows installer —
which cross-builds from macOS and Linux, with one script that must not be
skipped.

### Creating accounts

There is no seed user beyond the schema's. The quickest path:

1. `POST /api/v3/auth/admin` creates the organisation and its admin (see
   `auth.validation.js` for required fields).
2. `POST /api/v3/auth/signup` registers an employee as *pending*.
3. `POST /api/v3/user/admit-pending-signups` admits them into a department,
   location and role, as the admin.

An admitted employee can then sign in to both the portal and the agent.

---

## Things that will catch you out

Each of these cost real debugging time. They are documented in full where they
belong; this is the index.

| Symptom | Cause | Where |
|---|---|---|
| Screenshots upload fine but the gallery is empty | Filenames must be **UTC**, and the date is parsed by byte offset | `Agent/README.md` |
| Thumbnails broken, API returns 200 | MinIO's `api_endpoint` must resolve **from the browser**, and SigV4 signs the host | `DEPLOY.md` |
| Every activity upload fails Mongo validation | `employees.timezone` is null | fixed; `BACKLOG.md` 3.6 |
| `Failed to retrieve cloud integration data` | The organisation has no storage integration | `BACKLOG.md` 3.7 |
| Productive time is always 0% | No application has been classified yet | `BACKLOG.md` 3.9 |
| Agent reports no app names on Windows | Installer cross-built without the native addon | `Agent/README.md` |
| nginx 502 after a rebuild | Upstream hostnames must be resolved per request, not cached | `Frontend/nginx.conf` |

---

## Current state

**Working end to end**, verified against the Docker stack: signup and
admission, portal login for admin and employee, the agent's timer, screenshots
into MinIO, activity and app-usage into MongoDB, clock-in into MySQL, and the
portal rendering all of it.

**Not done yet** — the short version; `BACKLOG.md` has the full list with
estimates and reasoning:

- No server is deployed. This is the only thing blocking a pilot.
- The agent has no auto-update, no start-on-boot, and no keyboard/mouse counts.
- Browser URLs need an extension; today you get the window title.
- The agent ships **unsigned** — a deliberate decision, with mitigations.

**Deliberately out of scope, permanently:** keystroke *content* capture. It is
a keylogger — it captures passwords, guarantees antivirus problems, and is not
needed to report productive time.

---

## Repository layout

```
Agent/         Electron desktop agent (ours)
Backend/       Node.js services, one per directory
Frontend/      React + Vite portal, plus the nginx config that fronts everything
QT/            Upstream's Qt agent docs — no source, superseded by Agent/
docker-compose.yml
```

---

## Contributing and licence

Contribution notes are in [`Contributions.md`](Contributions.md).

Licensed **AGPL-3.0**, inherited from upstream: modified and distributed
versions must remain open source under the same licence.

Thanks to the EmpMonitor team and its contributors for the original platform.
