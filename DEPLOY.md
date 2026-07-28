# Deploying ATH Monitor

- [Where this is being hosted](#where-this-is-being-hosted)
- [Run it locally with Docker](#run-it-locally-with-docker)
- [What is and isn't containerised](#what-is-and-isnt-containerised)
- [Azure: test environment](#azure-test-environment-10-users-1-week)
- [Azure: production](#azure-production-300500-users)
- [Storage: the Azure gotcha](#storage-the-azure-gotcha)
- [Scaling: what's easy and what isn't](#scaling-what-is-easy-and-what-isnt)

---

## Where this is being hosted

**Decision: Hostinger KVM 2 for the pilot, not Azure.**

Roughly $8/month against $75–95 for the equivalent Azure B2ms once bandwidth
and managed services are counted — for a ten-person pilot that difference buys
nothing. The whole stack is Docker Compose on one box either way, so the
provider is a config detail rather than an architectural one, and moving later
is a `docker compose up` on a bigger machine.

The Azure sections below are **kept as the costing model for 300–500 users**,
not as the current plan. When the pilot outgrows one box, that is the analysis
to return to. Re-check the prices before relying on them.

What is still outstanding for the pilot deploy is tracked as Phase 1 in
[`BACKLOG.md`](BACKLOG.md); it is blocked only on SSH credentials and a
subdomain. Note in particular **1.5 — remove the `AUTH_METHOD_V3` login
bypass**, which must not reach a public host.

---

## Run it locally with Docker

```bash
cp .env.docker.example .env          # then edit the secrets
docker compose build

# start datastores first, load the schema once, then bring up everything
docker compose up -d mysql mongo redis minio
docker compose --profile setup run --rm migrations
docker compose up -d
```

Open **http://localhost:8090**.

`migrations` sits behind a compose profile deliberately: `Backend/migrations/emp-monitor.sql`
is **not idempotent** (it re-adds PRIMARY KEYs), so it must run once against a fresh
database, never on every `up`. Set `FRESH_DB=true` only if you want it to drop and
recreate the database first.

Everything is reachable through a single origin — nginx in the `frontend` container
serves the built SPA and reverse-proxies `/api/v3` to `admin`, `/api/v1` to
`store-logs-api`, and the WebSocket paths to the socket services. That removes CORS
entirely and means the frontend image has no hostnames baked in, so the same image
runs locally and on Azure.

| Useful URL | |
|---|---|
| App | http://localhost:8090 |
| MinIO console | http://localhost:9001 |
| Admin API direct | http://localhost:3010 |

---

## What is and isn't containerised

**Containerised:** the React frontend and all 8 backend services, plus MySQL,
MongoDB, Redis and MinIO.

**Not containerised — and never will be: the desktop agent.** It's a Qt/C++
program that runs *on each employee's computer*, not on a server. It's distributed
as an installer, not an image.

> ⚠️ **The agent's source code is not in this repository.** `QT/` contains a single
> file — `Readme.md`, a build guide. There are zero `.cpp`, `.h` or `.pro` files
> anywhere in the repo, and none have ever existed in git history. The Readme refers
> to files (`workspaces/emp_qt/emp.pro`, `scripts/prepare_2_windows_packages.bat`)
> that aren't present, and links a Google Drive download for a prebuilt `.exe`.
>
> **Consequence:** you can deploy and test the full web platform, but you cannot
> build an agent installer from this repo. Without the agent, screenshots, app/web
> usage, keystrokes and automatic timesheets will have no data — only the manual
> Start/Stop timer works. Get the Qt source from the upstream owner before planning
> a real pilot.

---

## Azure: test environment (10 users, 1 week)

> Superseded for the pilot — see [Where this is being hosted](#where-this-is-being-hosted).
> Hostinger KVM 2 gives comparable specs (2 vCPU / 8 GB) for roughly a tenth of
> this. Kept for the cost comparison and because the sizing logic still holds.

One VM running the whole compose stack. Mirrors how the app already runs on your
existing test server, so there are no surprises.

| Item | Spec | ~Monthly | ~1 week |
|---|---|---|---|
| VM (Ubuntu 22.04) | **B2ms** — 2 vCPU, 8 GiB | $60–75 | $15–19 |
| Managed disk | 128 GB Standard SSD | $10–12 | $3 |
| Bandwidth | light | ~$5 | ~$1 |
| **Total** | | **~$80–92** | **≈ $20–25** |

8 GiB is the floor — the stack needs roughly 4 GiB at idle (8 Node services ≈ 1 GiB,
MySQL ≈ 1 GiB, Mongo ≈ 1 GiB, plus Redis, MinIO and nginx). A 4 GiB B2s will thrash.

Screenshot volume for this pilot is **~0.5 GB total**. Delete the resource group when
you're done and billing stops.

Setup is: create the VM → install Docker → `git clone` → `cp .env.docker.example .env`
→ edit secrets → the three commands above.

---

## Azure: production (300–500 users)

### Storage is capped by retention — not a growth problem

Two settings together make storage a fixed, small cost:

1. **9 screenshots/hour** (~1 every 7 min) — 85% less than the old 60/hour default.
2. **40-day retention** — screenshots older than 40 days are deleted nightly.

With both, storage reaches a **steady state and stops growing**:

| Users | Screenshots retained | Steady-state storage | (Without retention, after 1 yr) |
|---|---|---|---|
| 10 | ~21,000 | **~3 GB** | 0.03 TB |
| 300 | ~617,000 | **~93 GB** | 0.9 TB |
| 500 | ~1,029,000 | **~154 GB** | 1.4 TB |

*8 working hours × ~28.6 working days inside a 40-day window, ~150 KB per screenshot.*

**Retention is already implemented — no code required.** Set it in the UI at
**Settings → Storage Types → "Delete Data Older Than (Days)" = 40**. It maps to the
`auto_delete_period` column, and the `checkScreensAge` cron (registered in
`Backend/cronjobs/src/cronjobs/v3/cronjobs.js` as `checkCloudStorage`) runs nightly
at **23:59 Asia/Kolkata** and prunes every configured storage provider.

> The pruning job lives in the **cronjobs** service. If that service isn't running,
> retention silently never happens and storage grows unbounded. Monitor it.

### 300 users

| Component | Spec | ~Monthly |
|---|---|---|
| App VM | D4s_v5 — 4 vCPU, 16 GiB | $140–180 |
| MySQL | Flexible Server, General Purpose 2 vCPU + 128 GB | $145–175 |
| MongoDB | Self-hosted, D2s_v5 + 256 GB SSD | $100–130 |
| Redis | Azure Cache, Standard C1 | $75–100 |
| Object storage | ~93 GB steady state (40-day retention) | $5–15 |
| Bandwidth | ~150 GB egress | $15–25 |
| Backups, snapshots, misc | | $40–60 |
| **Total** | | **≈ $520–685/month** |

### 500 users

| Component | Spec | ~Monthly |
|---|---|---|
| App VM | D8s_v5 — 8 vCPU, 32 GiB *(or 2 × D4s_v5 + load balancer)* | $280–350 |
| MySQL | Flexible Server, General Purpose 4 vCPU + 256 GB | $275–350 |
| MongoDB | Self-hosted, D4s_v5 + 512 GB SSD | $180–230 |
| Redis | Azure Cache, Standard C1 | $75–100 |
| Object storage | ~154 GB steady state (40-day retention) | $10–25 |
| Bandwidth | ~300 GB egress | $25–40 |
| Backups, LB, misc | | $50–80 |
| **Total** | | **≈ $895–1,175/month** |

**Why self-hosted MongoDB rather than Cosmos DB:** Cosmos bills by provisioned
throughput (RUs). At 500 agents writing activity logs continuously it becomes one of
the largest line items, easily several hundred dollars more per month than a VM
running MongoDB. Revisit only if you need Cosmos' global distribution.

**Cutting the bill:** 1-year Azure Reserved Instances cut VM costs ~35–40%, 3-year
~55%. On the 500-user estimate that's roughly **$250–350/month saved** on compute
alone. Commit once the pilot has validated the sizing.

> Prices are approximate pay-as-you-go for a US or Western Europe region and change
> regularly — confirm against the
> [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
> before committing budget.

---

## Storage: the Azure gotcha

> Only relevant if you go to Azure. On Hostinger, MinIO on the box is the
> answer and there is nothing to decide — skip to
> [Dual monitors double the screenshot bill](#dual-monitors-double-the-screenshot-bill).

**This codebase has no Azure Blob Storage driver.** Supported providers are S3,
Google Drive, OneDrive, Dropbox, Zoho WorkDrive, WebDAV, FTP and SFTP
(`Backend/store-logs-api/src/modules/v1/desktop/constants.ts`). Azure Blob is not
S3-compatible, so it cannot be dropped in.

Three options, costed at the **~154 GB steady state** that 40-day retention produces
(not the multi-terabyte figure you'd hit without it):

| Option | Effort | Cost at ~154 GB | Notes |
|---|---|---|---|
| **MinIO on the VM** | None — works today | ~$19/mo (256 GB SSD) | What `docker-compose.yml` ships with. |
| **Real AWS S3** | None — just configure it | ~$4/mo + egress | Cross-cloud egress and latency. |
| **Write an Azure Blob driver** | ~2–3 days | ~$3/mo | Cheapest per GB, but see below. |

**Recommendation: just use MinIO. Don't write the Blob driver.**

This reverses the earlier advice, and 40-day retention is why. Without retention,
storage would have grown past 1 TB and the driver would have paid for itself in
months. Capped at ~154 GB, the gap between MinIO-on-disk and Blob is about
**$16/month** — roughly $190/year, against 2–3 days of engineering plus ongoing
maintenance of a driver only you use. Not worth it. Spend that time on the
desktop agent instead.

### Dual monitors double the screenshot bill

The agent captures **every connected display**, as a separate image per
capture. Two monitors means two files every seven minutes, not one — so the
per-user storage figures above double for anyone on a dual-monitor desk, and
the steady-state numbers should be scaled by the *average displays per user*,
not the user count.

That is the right trade: capturing only the primary display would leave the
second screen completely unmonitored, which is precisely where someone would
put something they did not want seen. But budget for it rather than discovering
it.

Measured at ~100–190 KB per frame at the default quality (60) and 1600 px
longest edge. Both are in `Agent/src/main/config.js` if the bill needs trimming
— quality is the cheaper lever, since text stays legible well below 60.

### MinIO's `api_endpoint` must be reachable *by the browser*

This one will cost you an afternoon if you meet it cold, so it is worth setting
up correctly the first time.

The portal does not stream screenshots through the API. It asks S3 for a
**presigned URL** and hands that straight to an `<img>` tag, so the URL is
loaded by the employee's browser, not by the server. The host in that URL comes
from `api_endpoint` in the organisation's storage credentials
(`organization_provider_credentials.creds`).

Set `api_endpoint` to the internal Docker name and every thumbnail breaks:

```jsonc
// WRONG in any environment where a browser has to load the result.
// The backend can resolve "minio"; nobody's laptop can.
{ "api_endpoint": "http://minio:9000" }
```

The API still returns HTTP 200 with a perfectly valid, correctly signed link —
fetching it from inside the Docker network gives you the JPEG. It only fails in
the one place that matters. And you cannot rewrite the host afterwards, because
SigV4 signs the `Host` header: change it and the signature is void.

**The fix is one URL that resolves from both sides.** In production, put MinIO
behind the same nginx on its own subdomain and use that everywhere:

```jsonc
{ "api_endpoint": "https://storage.yourdomain.com" }
```

The backend reaches it over the public name (fine — it resolves), the browser
reaches it over the same name, and the signed host matches. Terminate TLS at
nginx and proxy to `minio:9000` with the `Host` header preserved.

Locally, the equivalent trick is to make `minio` resolve on the host too — add
`127.0.0.1 minio` to `/etc/hosts` and keep `api_endpoint` as
`http://minio:9000`, since port 9000 is already published. Without that, expect
working screenshot *records* with broken thumbnails.

---

## Scaling: what is easy and what isn't

**Vertical — easy.** Resize the VM in the portal and reboot: ~5 minutes downtime,
no code changes. This alone comfortably covers 100–150 users, and probably 300 on a
D8s_v5. Managed MySQL and Redis both scale their tier the same way.

**Horizontal — real work, roughly 2–4 weeks.** You cannot simply switch on Azure
autoscale, because:

- **`realtime` hardcodes its worker count.** `Backend/realtime/server.js` sets
  `numCPUs = 2` with the "use all cores" line commented out — it won't use a larger VM.
- **WebSocket state isn't shared.** Three services hold long-lived connections.
  `realtime` uses Redis pub/sub, but `web-socket-server` and `remote_socket` don't —
  they need sticky sessions or a Redis backplane before running multiple instances.
- **No health-check endpoints.** A load balancer has nothing reliable to probe;
  most services have no `/health` route.
- **Deployment assumes one box.** `.github/workflows/deploy.yml` SSHes in, runs
  `git pull` and restarts pm2. It has no concept of multiple instances. The Docker
  setup here is the first step away from that.

**Suggested path:** pilot on a single VM → measure real per-user resource use →
scale vertically for the first 100–300 users → do the horizontal work only when
you actually approach the ceiling.

### Before a 500-user launch

1. Get the Qt agent source — without it there is no monitoring data.
2. Write the Azure Blob driver (or commit to MinIO/S3).
3. Fix `realtime`'s hardcoded worker count.
4. Add `/health` endpoints to every service.
5. Add a Redis backplane to the two socket services that lack one.
6. Turn on the screenshot retention cron so storage stops growing forever.
7. Load-test with simulated agents — this codebase has never run at this scale.
