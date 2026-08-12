# Self-hosting checklist (no Docker)

This is the container-free path: the storefront running on plain Node against a
Postgres you provide, on a machine you control. No Docker, no Podman, no Netlify
account, no build step. The application source is used exactly as it is
deployed — nothing in `netlify/` is modified or compiled.

If containers are what defeated you, this is the path to take. `container/`
still holds a Dockerfile and compose file for anyone who wants them, but nothing
here needs them.

> **Before you start:** self-hosting does not reduce the AI bill. Model calls go
> to Anthropic either way. What it removes is Netlify; what it adds is uptime,
> backups, TLS renewal, and OS patching. See
> [`running-without-a-container.md`](running-without-a-container.md) for whether
> you actually want this.

## What was verified

Steps 3–7 were run end to end in a clean checkout and behaved as described. The
server booted with **37 functions (71 routes) and 5 edge functions loaded**, and
these routes answered correctly:

| Route | Result |
|---|---|
| `/` | 200, full homepage, edge CSP header applied |
| `/code` | 200, the workspace editor |
| `/api/code` | 401 — owner auth gate active |
| `/404.html` | 200 |
| `/p/<slug>/` | 404 — no such published app |
| `/robots.txt` | 200 |
| `/netlify/lib/*.mts`, `/container/*`, `/package.json` | 404 — source is refused |

The offline suite passes at **83 checks**.

Steps 1–2 and 8–11 (Postgres, TLS, systemd, Stripe) were **not** exercised —
no Postgres or public hostname was available in the verification environment.
They are written from the code that consumes them, not from a live run. Treat
them as accurate but untested, and expect to debug the reverse proxy.

One useful thing was confirmed about running without a database: the site does
not crash. `loadCatalog` falls back to the bundled catalog and logs
`No database configured`, and `migrate.mjs` exits with `DATABASE_URL is not set`
rather than a stack trace. A misconfigured `DATABASE_URL` therefore looks like a
site with no reviews and no saved apps — not an outage. Check the logs.

### A defect this found, and fixed

`publish = "."` in `netlify.toml` means the repository root *is* the directory
being served. Netlify's CDN strips the functions tree on the way out; nothing
stripped it here, and nothing stripped anything else at all. A plain GET
returned the site's own source:

- `/netlify/lib/admin-auth.mts` — the owner session and HMAC logic
- `/netlify/functions/*.mts`, `/netlify/edge-functions/*.ts`
- `/netlify/database/migrations/*.sql`
- `/container/.env.example`, `/container/server.mjs`
- `/package.json`, `/netlify.toml`
- `/packages/site-audit-agent/**` — a product sold under a single-purchaser
  licence

This was true of the deployed site too, not only the self-hosted path. Two
fixes, because the two serve files by different mechanisms:

- **Self-hosted** — `isDeniedPath()` in `container/lib/static.mjs` refuses these
  paths before the URL is ever resolved against the filesystem. It compares
  lower-cased path segments, because on macOS and Windows `/NETLIFY/...` opens
  the same file as `/netlify/...`.
- **Netlify** — forced `status = 404` redirects in `netlify.toml`. `force = true`
  is required: without it a redirect rule loses to a file that exists on disk,
  which is exactly the situation here.

Both are covered by the smoke suite and were confirmed by request against a
running server.

---

## 1. Machine

Anything with 1 GB of RAM will do. The process is a single Node server.

- **Node 22.6 or newer** — required, not a preference. The server imports the
  site's `.mts` files directly using Node's native TypeScript type-stripping.
  Older Node cannot load them at all.
  ```sh
  node -v          # must be >= v22.6
  ```
- **Postgres 14 or newer**, local or managed. A managed instance (Neon, Supabase,
  RDS, your host's add-on) is the lower-maintenance choice and keeps backups out
  of your hands.

## 2. Database

Create a database and a user, and hold onto the connection string. Nothing else
is needed — no extensions, no manual tables.

```sh
createdb storefront
```

## 3. Get the code

```sh
git clone <your-repo-url> storefront
cd storefront
```

## 4. Install dependencies

Two installs. The first is the application's own; the second is `pg`, the only
thing the database adapter needs.

```sh
npm ci
npm --prefix container ci
```

There is deliberately no build step after this. Do not look for one.

## 5. Configure

```sh
cp container/.env.example container/.env
```

Fill it in. The file lists every variable the app reads; the ones that matter
for a first boot are the database URL, the owner password, and the site URL.
The Stripe, Resend, and Anthropic keys can be left empty — the features that
need them return a clean "not configured" error instead of crashing, so you can
get the site up first and add keys as you go.

Keep `container/.env` out of version control. It is already gitignored.

## 6. Migrate

```sh
set -a; . container/.env; set +a
node --import ./container/hooks/register.mjs container/migrate.mjs
```

This applies everything in `netlify/database/migrations/` and records what it
applied in a `container_schema_migrations` ledger, so it is safe to re-run and
safe to run on every deploy. It reads the same migration directory Netlify uses,
which is why the `/code` workspace tables exist here too — the in-browser editor
works off Netlify without any extra step.

## 7. Run it

```sh
node --import ./container/hooks/register.mjs container/server.mjs
```

Then open `http://localhost:8080`. Useful environment overrides:

- `PORT` — defaults to 8080
- `HOST` — defaults to `0.0.0.0`
- `ENABLE_SCHEDULER=false` — skip the four cron jobs (see step 10)
- `TRUST_PROXY=true` — required once you put a reverse proxy in front, otherwise
  every visitor's IP reads as the proxy's and rate limiting collapses onto one
  bucket

## 8. Keep it running

A minimal systemd unit. Adjust the paths and user.

```ini
[Unit]
Description=storefront
After=network.target

[Service]
Type=simple
User=storefront
WorkingDirectory=/srv/storefront
EnvironmentFile=/srv/storefront/container/.env
ExecStart=/usr/bin/node --import ./container/hooks/register.mjs container/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl enable --now storefront
sudo journalctl -u storefront -f
```

## 9. TLS and a public hostname

Caddy is the least work — it obtains and renews certificates on its own.

```caddyfile
your-domain.com {
    reverse_proxy localhost:8080
}
```

Then set `TRUST_PROXY=true` and `SITE_URL=https://your-domain.com` in
`container/.env` and restart. `SITE_URL` is what the app uses to build absolute
links in emails and Stripe redirects, so a wrong value here produces checkout
flows that bounce to localhost.

## 10. Scheduled jobs

Netlify runs four cron functions. Self-hosted, the server's own scheduler runs
them in-process, enabled by default. Turn it off with `ENABLE_SCHEDULER=false`
if you run more than one instance — otherwise each instance runs every job.

| Job | Schedule |
|---|---|
| `site-maintenance-agent` | hourly |
| `discovery-crawler` | daily, 03:00 |
| `indexnow-submit` | every 12 hours |
| `subscriber-digest` | weekly |

The first two make Claude calls on every run — roughly 730 calls a month
combined. Both are on Haiku, so this is around $1.50 a month, but it is the only
cost that accrues while nobody is visiting.

## 11. Stripe

Stripe needs a publicly reachable HTTPS endpoint to deliver webhooks, so this
only works after step 9. Point the webhook at `https://your-domain.com/api/webhook`
and put the resulting signing secret in `container/.env`. Until then, checkout
completes but fulfilment never fires.

## 12. Backups

Nothing else in this setup holds state — the database is all of it. If you used
a managed Postgres, backups are already handled. If you run it yourself:

```sh
pg_dump "$DATABASE_URL" | gzip > storefront-$(date +%F).sql.gz
```

Put that on a timer and copy it off the machine. Apps written in `/code` live in
those tables, so an unbacked-up database means losing them.

## Checking it worked

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/          # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/code      # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/code  # 401
node container/test/smoke.mjs                                            # 83 passed
```

A 401 from `/api/code` is the correct answer — it means the owner auth gate is
live. Log in at `/code` with `ADMIN_PASSWORD`.

Then confirm the server is not handing out its own source. Every one of these
must answer 404:

```sh
for p in /netlify/lib/admin-auth.mts /container/.env /package.json /netlify.toml \
         /packages/site-audit-agent/lib/audit.mjs /node_modules/pg/package.json; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080$p)" "$p"
done
```

A 200 from any of them means the deny list is not in place — stop and fix that
before the machine is reachable from the internet.
