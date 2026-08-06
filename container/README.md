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

## The image

Published to GitHub Container Registry as `ghcr.io/<owner>/jblessd-store`,
where `<owner>` is the GitHub account this repository lives under. Built for
`linux/amd64` and `linux/arm64`, so it runs on both a normal server and an
Apple-silicon laptop from the same tag.

| Tag | Points at |
| --- | --- |
| `latest` | the most recent release |
| `1.4.0`, `1.4`, `1` | that release, and the moving major/minor aliases |
| `edge` | the tip of `main` — builds, but unreleased |
| `sha-<full-sha>` | one exact commit, never moved |

Pin `1.4` in production. `latest` moves under you on the next release, and
`edge` is not release-gated.

Running it needs only the image, a Postgres, and somewhere to keep blobs:

```sh
docker run -d --name jblessd \
  -p 8080:8080 \
  --env-file container/.env \
  -e DATABASE_URL=postgres://... \
  -v jblessd-blobs:/data/blobs \
  ghcr.io/<owner>/jblessd-store:1.4
```

Migrations are a separate one-shot run of the same image — see the `migrate`
service in `docker-compose.yml` for the exact command. Apply them before
starting the app, not alongside it.

To point the compose stack at a published tag instead of building from source,
set `APP_IMAGE` and pull:

```sh
APP_IMAGE=ghcr.io/<owner>/jblessd-store:1.4 \
  docker compose -f container/docker-compose.yml pull
APP_IMAGE=ghcr.io/<owner>/jblessd-store:1.4 \
  docker compose -f container/docker-compose.yml up
```

### Publishing

Pushing a `v*` tag publishes a release; pushing to `main` refreshes `edge`.
Both run the smoke suite first, and neither can publish a build that fails it.

```sh
git tag v1.4.0 && git push origin v1.4.0
```

**One-time activation.** The workflow that does this lives at
`container/ci/container-image.yml` and is not active there. GitHub rejects any
push that touches `.github/workflows/` unless the pushing app holds the
`workflows` permission, which Netlify's GitHub App does not — so the file is
parked outside that directory and you move it in yourself:

```sh
git mv container/ci/container-image.yml .github/workflows/
git commit -m "Add container image workflow" && git push
```

The alternative is to grant the Netlify GitHub App the `workflows` permission
in the repository's GitHub App settings, after which agent-authored changes to
workflow files push normally. The move is the smaller change; the permission is
the one that stops this recurring.

Once it is in place, its manual run builds both architectures without
publishing, which is the cheap way to check that a Dockerfile change still
compiles before tagging anything.

For a build on your own machine — a debug image, or a registry that is not
GHCR — `container/image.sh` does the same tagging locally, and needs no
workflow at all:

```sh
container/image.sh                                  # :dev and :sha-<short>
PUSH=1 container/image.sh 1.4.0                     # release, all four tags
IMAGE_REPO=registry.example.com/store PUSH=1 container/image.sh 1.4.0
```

It builds for the host architecture only; the multi-arch manifest comes from
CI. Note that a new GHCR package is **private** until you make it public in the
repository's package settings — the first `docker pull` from an unauthenticated
machine is what usually surfaces this.

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
