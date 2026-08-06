# Running jblessd.com in a container

This directory runs the storefront on plain Node, with no Netlify account, no
build step, and no changes to the application source. The site's own files —
`index.html`, `netlify/functions/*.mts`, `netlify/edge-functions/*.ts`,
`netlify/lib/*.mts` — are used exactly as they are deployed today.

## Quick start

```sh
cp container/.env.example container/.env      # then fill it in
docker compose -f container/docker-compose.yml up --build
```

That brings up three services: Postgres, a one-shot migration job, and the app
on `http://localhost:8080`. The app does not start until the migrations have
finished, so a fresh volume is fully migrated before the first request.

To run it without Docker, against a Postgres you already have:

```sh
npm ci                                        # the app's own dependencies
npm --prefix container ci                     # pg, for the database adapter
DATABASE_URL=postgres://... \
  node --import ./container/hooks/register.mjs container/migrate.mjs
DATABASE_URL=postgres://... \
  node --import ./container/hooks/register.mjs container/server.mjs
```

Node 22.6 or newer is required — the server relies on native TypeScript type
stripping to load the `.mts` and `.ts` sources directly. The image pins Node 24.

## How it works

Netlify provides five things this site depends on. Each is replaced by one
small, readable module rather than by a framework.

| Netlify provides | Replaced by |
| --- | --- |
| `@netlify/database` (Neon) | `adapters/netlify-database.mjs` — a `pg.Pool`, with the tagged-template `sql` helper turning values into `$1`, `$2` bind parameters |
| `@netlify/blobs` | `adapters/netlify-blobs.mjs` — a directory on disk, one file per key |
| `purgeCache()` | `adapters/netlify-functions.mjs` — a no-op, and the one place to wire a real CDN purge |
| Function + edge-function routing | `lib/routes.mjs`, driven by each module's own `export const config` |
| Redirects, headers, static serving | `lib/config.mjs` + `lib/static.mjs`, driven by `netlify.toml` |

Two details make the no-changes claim work:

**`hooks/resolver.mjs`** is the linchpin. It maps the four `@netlify/*`
specifiers to the adapters above, and — because the application imports its
own modules as `./db.mjs` while the files on disk are `db.mts` — retries a
failed `.mjs` resolution against `.mts`. Nothing loads without it, which is why
every entry point is launched with `--import ./container/hooks/register.mjs`.

**The edge functions run unmodified.** All four import only *types* from
`@netlify/edge-functions` and use no Deno globals, so `pages.ts` (the 1,100-line
SSR renderer) and `csp.ts` (per-request nonce stamping) execute in Node as-is.
`lib/netlify-global.mjs` supplies the one runtime global they do touch,
`Netlify.env.get`.

`netlify.toml` is parsed at boot, not transcribed. Redirects, header rules and
the edge-function chain order all come from the same file Netlify reads, so the
two cannot drift.

## Configuration

See `.env.example` for the full list with notes. The ones that change behaviour
rather than just enabling a feature:

- **`SITE_URL`** — the public URL. Also the origin the scheduled crawler and
  IndexNow jobs audit, so leaving it as `localhost` makes them crawl the
  container instead of the real site.
- **`TRUST_PROXY`** — set `true` only when a reverse proxy you control sits in
  front. On without a proxy, any client can spoof its own IP past the rate
  limiter.
- **`ENABLE_SCHEDULER`** — set `false` on a second replica, or when running
  alongside the Netlify deploy, so the cron jobs do not double up.
- **`BLOBS_DIR`** — where blob storage lives. Must be a persistent volume.

Missing optional keys degrade rather than fail: without `ANTHROPIC_API_KEY` the
AI endpoints return an error but the storefront still sells; without
`RESEND_API_KEY` every send is a logged no-op. `STRIPE_SECRET_KEY` is the
exception — `netlify/functions/webhook.mts` throws at import if it is unset, so
that route becomes a 503 while the rest of the site serves normally.

## Topology constraint

**Run one instance.** Two things are node-local rather than shared:

- Blob storage is a directory. Two containers behind a load balancer would each
  see only their own writes, which breaks Stripe webhook deduplication and
  makes rate limiting per-instance.
- The scheduler is in-process, with no distributed lock. Two instances with
  `ENABLE_SCHEDULER=true` run every cron job twice.

For a second replica: point both at shared blob storage (swap
`adapters/netlify-blobs.mjs` for an S3-backed implementation — it is 100 lines
and the interface is four methods) and set `ENABLE_SCHEDULER=false` on all but
one.

## Operations

- **Health check** — `GET /healthz`, answered outside the request pipeline so it
  stays up even if routing is misconfigured. The image's `HEALTHCHECK` uses it.
- **Shutdown** — `SIGTERM` stops accepting connections, drains in-flight
  requests, closes the database pool, and force-exits after 10 seconds.
- **Migrations** — `container/migrate.mjs` applies everything in
  `netlify/database/migrations/`, one transaction each. `--check` reports what
  is pending without applying it. The ledger table is
  `container_schema_migrations`, deliberately *not* `schema_migrations`, so
  pointing this at the existing Neon database cannot corrupt Netlify's own
  bookkeeping.
- **A function that throws at import** becomes a 503 on its own routes instead
  of taking down the server.

## Tests

```sh
node --import ./container/hooks/register.mjs container/test/smoke.mjs
```

52 assertions covering the seams — the places where this container
reimplements something Netlify used to do, which are what break silently. TOML
parsing against the real `netlify.toml`, path matching, cron evaluation, header
precedence, form detection, SQL parameter binding (including that a hostile
string stays a bind parameter), and blob traversal containment.

The application's own logic is not retested; it is unchanged.
