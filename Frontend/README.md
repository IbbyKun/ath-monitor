# Frontend — ATH Monitor portal

React 19 + Vite 7 single-page app. This is the web portal: admins manage
employees, review screenshots and timesheets, and classify applications as
productive or not; employees see their own data.

For the system as a whole, start at [`../README.md`](../README.md).

## Running it

Normally you don't run this on its own — `docker compose up -d` from the
repository root builds it and serves it through nginx on
**http://localhost:8090**, with the API proxied on the same origin.

For a dev server with hot reload, pointed at a stack that is already up:

```bash
npm install --legacy-peer-deps
npm run dev
```

`--legacy-peer-deps` is required: several Radix and chart packages have not yet
declared React 19 support in their peer ranges, though they work with it.

## Two things to know before changing config

**Vite inlines `VITE_*` at build time**, not runtime. They are build args in
`docker-compose.yml`, which is why the image has to be rebuilt after changing
one — restarting the container does nothing.

**Never set a `VITE_*` URL to an empty string.** `api.service.js` reads
``import.meta.env.VITE_BACKEND_V4_URL || '<hardcoded production URL>'``, and an
empty string is falsy. A blank value therefore does not mean "same origin" — it
silently points the browser at the upstream production API. Use `"/"`.

## nginx

[`nginx.conf`](nginx.conf) serves the built SPA and reverse-proxies the API, so
the browser only ever talks to one origin and CORS never enters the picture.

It resolves upstreams through a `resolver` directive with variables in
`proxy_pass`, rather than naming them literally. This is deliberate and is
explained in the file: nginx resolves a literal hostname once at worker start
and caches the IP forever, so every backend redeploy would otherwise leave it
dialling a dead container until nginx itself was restarted. Do not "simplify"
those back.

## Layout

```
src/
  page/protected/admin/      admin pages, one directory each
  page/protected/employee/   employee-facing pages
  page/auth/                 login, signup
  components/common/         shared feature components
  components/ui/             shadcn primitives
  hooks/useDlpStore.js       factory behind the DLP-style report pages
  services/api.service.js    axios instance and interceptors
  i18n/                      six locales; add new keys to all of them
```

Routes live in `src/App.jsx`; the sidebar is
`src/page/protected/admin/layout/AppSidebar.jsx`. A page is only reachable if it
appears in both — several upstream pages exist and work but have no menu entry
(tracked in `../BACKLOG.md`).
