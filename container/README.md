# Running jblessd.com in a container

> **You probably don't need this.** The deployed Netlify site already hosts itself:
> the code lives on the site, Netlify runs every part of it, and using it means
> opening a URL on a phone or a computer — optionally installed as an app window.
> See [`docs/running-without-a-container.md`](../docs/running-without-a-container.md).
>
> The one thing this directory used to offer that the live site could not was a
> place to *write and run code* without deploying. That is now on the site too, at
> `/code`: you write an app in the browser and it is served at `/p/<name>` as soon
> as it saves — see
> [`docs/writing-code-on-the-site.md`](../docs/writing-code-on-the-site.md).
>
> This directory is for the separate case of running the same code *off* Netlify,
> on hardware you control. If Docker or Podman will not cooperate, nothing about
> the live site is blocked on it.

This directory runs the storefront on plain Node, with no Netlify account, no
build step, and no changes to the application source. The site's own files —
`index.html`, `netlify/functions/*.mts`, `netlify/edge-functions/*.ts`,
`netlify/lib/*.mts` — are used exactly as they are deployed today.

## Quick start

```sh
cp container/.env.example container/.env      # then fill it in
docker compose -f container/docker-compose.yml up --build
```

On Podman, use the script instead — the reason is in **Podman** below:

```sh
cp container/.env.example container/.env      # then fill it in
container/podman.sh up --build
```

On Windows, where that shell script cannot run, use the PowerShell equivalent —
see **Windows** below:

```powershell
Copy-Item container\.env.example container\.env
.\container\podman.ps1 up -Build
```

Either way that brings up three things: Postgres, a one-shot migration job, and
the app on `http://localhost:8080`. The app does not start until the migrations
have finished, so a fresh volume is fully migrated before the first request.

To run it without a container runtime at all, against a Postgres you already
have:

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

For the full version of that path — systemd, TLS, the scheduler, Stripe
webhooks, backups, and what to check at each step — see
[`docs/self-hosting-checklist.md`](../docs/self-hosting-checklist.md).

## Podman

The image itself is ordinary OCI and runs unchanged; what differs is everything
around it. `container/podman.sh` is the supported path:

```sh
container/podman.sh up             # start Postgres, migrate, start the app
container/podman.sh up --build     # rebuild the image first
container/podman.sh logs           # follow the app's output
container/podman.sh status
container/podman.sh migrate        # re-run migrations against a live stack
container/podman.sh down           # stop and remove; volumes survive
container/podman.sh down --volumes # ...and delete the data too
```

It runs the same three steps as compose, in one pod, with the ordering written
out as shell rather than declared as `depends_on` conditions. Rootless is the
expected mode; nothing here needs `sudo`.

`container/image.sh` builds under either runtime — it picks whichever of
`docker` or `podman` is on `PATH`, and `CONTAINER_ENGINE=podman` forces it on a
machine that has both.

### Windows

`podman.sh` is POSIX shell and will not run in PowerShell or cmd, so Windows has
its own entry point with the same commands:

```powershell
Copy-Item container\.env.example container\.env    # then fill it in
.\container\podman.ps1 up -Build                   # build the image, then start
.\container\podman.ps1 logs
.\container\podman.ps1 status
.\container\podman.ps1 migrate
.\container\podman.ps1 down                        # -Volumes to delete data too
```

Note the switch is `-Build`, not `--build`. Three things differ from Linux and
account for most Windows-only failures:

- **The Podman machine has to be running.** `podman` on Windows is a client for
  a Linux VM: `podman machine init` once, then `podman machine start`. Without it
  every command fails with a connection error that never mentions the machine.
  `podman.ps1` checks this first and says so.
- **Execution policy.** If PowerShell refuses to run the script at all, that is
  the machine's default policy, not the script:
  `powershell -ExecutionPolicy Bypass -File .\container\podman.ps1 up -Build`.
- **Line endings.** Git on Windows checks text files out as CRLF unless told
  otherwise, which breaks the shell scripts under WSL and puts a stray carriage
  return at the end of every value in `container/.env`. The repository's
  `.gitattributes` pins the affected files to LF; a checkout made before it
  existed keeps the old endings, so refresh it with
  `git rm --cached -r . && git reset --hard`.

`podman.ps1` reads `container/.env` itself and passes the values with `-e`
instead of handing the file to `--env-file`, so a CRLF `.env` cannot poison
`POSTGRES_PASSWORD` with a trailing carriage return — the failure that shows up
as a password error against a database whose password is right.

**Why not just point compose at Podman.** `docker-compose.yml` gates the app on
Postgres reporting healthy and on the migration job exiting 0. Under
`podman-compose` those conditions are not reliably honoured, and when they are
skipped all three services start at once: the migration races an unready
database and the app serves against unmigrated tables. `podman compose` backed
by the real `docker-compose` binary does honour them — if that is your setup,
the compose file works as written, but run it from inside `container/` so that
`.env` and the relative `env_file` resolve the way Compose expects.

**If it still fails, it is usually one of these.**

| Symptom | Cause |
| --- | --- |
| `short-name "jblessd-store:local" did not resolve` | Podman resolves an unqualified name against `registries.conf`, not against local storage, so a bare name is looked for on a registry that has never heard of it. The local image is `localhost/jblessd-store:local` — that is now the default everywhere. Set `APP_IMAGE` to the `localhost/` form if a local edit dropped it. |
| `unauthorized` or `manifest unknown` pulling `ghcr.io/...jblessd-store` | The package does not exist yet — the publish workflow is a one-time activation away, see **Publishing**. GHCR reports a missing package as an auth failure, so this looks like a credentials or URL problem and is neither. `podman login` will not help. Build locally instead. |
| `pull access denied` for `jblessd-store:local` from Docker Hub | Same short-name cause as above, on a machine whose `registries.conf` lists `docker.io`. Podman resolved the bare name to `docker.io/library/jblessd-store` and asked Docker Hub for it. |
| `short-name "node:24-alpine" did not resolve` | Podman does not assume Docker Hub for a bare image name. Both image references are fully qualified; if a local edit reintroduces one, spell out `docker.io/library/`. |
| `Cannot connect to Podman` / connection refused, on Windows | The Podman machine is not running. `podman machine init` once, then `podman machine start`. See **Windows** above. |
| `/bin/sh^M: bad interpreter`, or `cannot execute: required file not found` | A CRLF checkout of a `.sh` script. `.gitattributes` now pins these to LF; refresh an older checkout with `git rm --cached -r . && git reset --hard`. |
| `running scripts is disabled on this system` | PowerShell execution policy, not `podman.ps1`. Run it as `powershell -ExecutionPolicy Bypass -File .\container\podman.ps1 up -Build`. |
| Password errors from Postgres when the password is correct | A CRLF `container/.env` gave `--env-file` a value with a trailing carriage return. `podman.ps1` and `podman.sh` both strip it; `docker compose` and raw `--env-file` do not. |
| `docker: command not found` from `image.sh` | Fixed — the script now detects the engine. Set `CONTAINER_ENGINE=podman` if detection picks wrong. |
| Hangs at "waiting for healthy" | Podman runs `HEALTHCHECK` on a systemd timer. Without a user systemd session (WSL without it, a CI runner) health never leaves `starting`. `podman.sh` polls `pg_isready` instead and does not depend on it. |
| `EACCES` / permission denied writing `/data/blobs` | A rootless bind mount maps the container's `node` user to a subuid that does not own the host directory. Use the named volume `podman.sh` creates, or add `:U` to the mount, or run with `--userns=keep-id`. |
| `ECONNREFUSED 127.0.0.1:5432` at boot | The app started before Postgres was ready. This is exactly the race `podman.sh` serialises. |
| Migrations look applied but tables are missing | Two ledgers. This container tracks in `container_schema_migrations`; a database previously migrated by Netlify tracks its own. Pointing at an existing Neon database is safe but re-applies from this container's point of view. |
| Port 8080 in use, or refused below 1024 | Rootless Podman cannot publish privileged ports without `net.ipv4.ip_unprivileged_port_start`. Set `PORT` in `container/.env` to something above 1024 and put a reverse proxy in front. |

## The image

**Which reference to use right now:** `localhost/jblessd-store:local`, built on
your own machine. Nothing has been published to a registry yet, so the GHCR URL
below is a destination, not something you can pull today.

```sh
container/podman.sh up --build          # Linux/macOS — builds, then starts
.\container\podman.ps1 up -Build        # Windows
```

Once **Publishing** below has been activated, the registry URL for this
repository is:

```
ghcr.io/duprejesse3-ops/jblessd-store
```

GitHub Container Registry, under the account that owns the repository. Built for
`linux/amd64` and `linux/arm64`, so it runs on both a normal server and an
Apple-silicon laptop from the same tag.

| Tag | Points at | Full URL |
| --- | --- | --- |
| `latest` | the most recent release | `ghcr.io/duprejesse3-ops/jblessd-store:latest` |
| `1.4.0`, `1.4`, `1` | that release, and the moving major/minor aliases | `ghcr.io/duprejesse3-ops/jblessd-store:1.4` |
| `edge` | the tip of `main` — builds, but unreleased | `ghcr.io/duprejesse3-ops/jblessd-store:edge` |
| `sha-<full-sha>` | one exact commit, never moved | `ghcr.io/duprejesse3-ops/jblessd-store:sha-<full-sha>` |

Pin `1.4` in production. `latest` moves under you on the next release, and
`edge` is not release-gated.

**Nothing answers any of those URLs yet.** The publish workflow is still a
one-time activation away — see **Publishing** below. Until it runs, `podman pull
ghcr.io/duprejesse3-ops/jblessd-store:1.4` fails, and because GHCR does not
distinguish "no such package" from "you may not see it", the error is a
misleading `unauthorized` or `manifest unknown` rather than a plain 404. That is
not a wrong URL and `podman login` will not fix it; the image simply does not
exist yet. Build locally, or activate the workflow.

To print the URL and its tags for whatever you are about to build, without a
Docker daemon and without hardcoding the account name anywhere:

```sh
container/image.sh --url                 # ghcr.io/<owner>/jblessd-store:dev, :sha-<short>
container/image.sh --url 1.4.0           # the four release tags
```

It derives the owner from `git remote origin`, so a fork prints its own URL. In a
checkout with no GitHub remote it prints `localhost/jblessd-store:…` instead —
the name Podman gives a locally built image, and one that `PUSH=1` refuses to
publish so a local-only build cannot be pushed anywhere by accident.

Running it needs only the image, a Postgres, and somewhere to keep blobs:

```sh
docker run -d --name jblessd \
  -p 8080:8080 \
  --env-file container/.env \
  -e DATABASE_URL=postgres://... \
  -e PORT=8080 \
  -v jblessd-blobs:/data/blobs \
  ghcr.io/duprejesse3-ops/jblessd-store:1.4
```

`podman run` takes the same flags. Keep `-e PORT=8080` if you pass `--env-file`:
`PORT` in that file chooses the *host* side of `-p`, and letting it through
would make the app listen on a port the mapping does not point at.

Migrations are a separate one-shot run of the same image — see the `migrate`
service in `docker-compose.yml` for the exact command. Apply them before
starting the app, not alongside it.

To point the compose stack at a published tag instead of building from source,
set `APP_IMAGE` and pull:

```sh
APP_IMAGE=ghcr.io/duprejesse3-ops/jblessd-store:1.4 \
  docker compose -f container/docker-compose.yml pull
APP_IMAGE=ghcr.io/duprejesse3-ops/jblessd-store:1.4 \
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
container/image.sh --url 1.4.0                      # print the URLs, build nothing
PUSH=1 container/image.sh 1.4.0                     # release, all four tags
IMAGE_REPO=registry.example.com/store PUSH=1 container/image.sh 1.4.0
```

It builds for the host architecture only; the multi-arch manifest comes from
CI. Note that a new GHCR package is **private** until you make it public in the
repository's package settings — the first `docker pull` from an unauthenticated
machine is what usually surfaces this.

### Offline: an image tar file for Linux

For a target that cannot reach a registry — an air-gapped server, a customer's
box, a machine behind a proxy that blocks GHCR — `container/save.sh` writes the
whole image to a single file you copy over:

```sh
container/save.sh                       # dist/jblessd-store-dev-linux-amd64.tar
container/save.sh --gzip 1.4.0          # dist/jblessd-store-1.4.0-linux-amd64.tar.gz
container/save.sh --platform linux/arm64 --gzip 1.4.0
container/save.sh --pull 1.4            # export the published tag, build nothing
```

Then on the Linux target, with no network involved:

```sh
sha256sum -c jblessd-store-1.4.0-linux-amd64.tar.gz.sha256
docker load -i jblessd-store-1.4.0-linux-amd64.tar.gz     # podman load -i works too
```

The archive carries the same image reference `image.sh` would have pushed, so
after a `load` the tag is already what the compose stack expects — nothing needs
retagging:

```sh
APP_IMAGE=ghcr.io/duprejesse3-ops/jblessd-store:1.4 \
  docker compose -f container/docker-compose.yml up
```

Details worth knowing:

- **It defaults to `linux/amd64`, not to your machine.** The point of the file is
  to be carried to a server, and that server is usually amd64. On an
  Apple-silicon laptop that means an emulated build: Docker Desktop ships the
  binfmt handlers so it just works but is slow, while a bare Linux arm64 host
  needs `qemu-user-static` first. `--platform linux/arm64` avoids emulation when
  the target really is arm64.
- **`--gzip` is worth it.** Layers sit uncompressed inside a `docker save`
  archive, so gzip typically halves the file, and both runtimes load the `.gz`
  directly.
- **A `.sha256` is written beside the archive** in `sha256sum -c` format, since a
  file that travelled by USB stick gets no other integrity check.
- **`--pull` exports instead of rebuilding**, so the bytes on the target are the
  released ones, digest and all. Without it the tar is built from your working
  tree, and a dirty tree gets the same warning `image.sh` gives.
- **`--oci` writes an OCI archive** rather than a docker-archive, for tooling
  that wants one. It needs Podman or buildx — plain `docker save` has only the
  one format, and both runtimes load a docker-archive anyway.
- Output goes to `dist/`, which is gitignored and excluded from the build
  context. `--output some/path.tar.gz` puts it elsewhere.

When CI is active (see above), the same tars are attached to every release and
to each manual run, so the usual way to get one is to download it rather than to
build it.

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
