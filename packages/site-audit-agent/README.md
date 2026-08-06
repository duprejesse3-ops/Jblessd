# site-audit-agent

A website audit agent you own outright. Point it at a URL, get a scored report on
what is broken. It runs on your laptop, your server, your CI, or your host —
whichever you prefer, and you can change your mind later without rewriting
anything.

```
$ node bin/audit.mjs example.com

Site audit — https://example.com/
Score 53/100  ·  unhealthy  ·  6 problems to fix and 4 warnings

  ✗ Meta description
    No meta description — search engines will invent one from page text
  ✗ Structured data
    No JSON-LD structured data — no rich results, no AI answer-engine grounding
  ✗ Sitemap
    No readable sitemap at the declared location or /sitemap.xml
  ...
  ✓ Reachable
    Homepage responded in 88ms
```

## What makes it different

**Zero dependencies.** Not "few". None. The `dependencies` block in `package.json`
is empty and stays that way. It uses the global `fetch` and `URL` that ship with
Node 18+, and nothing else. There is no `npm install`, no lockfile to audit, no
transitive supply chain, no dependency that can be deprecated or taken over.

**No build step.** Plain `.mjs`. What is in the repository is what runs. No
TypeScript toolchain, no bundler, no transpile.

**No service, no account, no key.** It does not call an API, does not call home,
and has no vendor. There is no free tier to age out of and no company that can
change its pricing on you.

**Nothing platform-specific in the engine.** `lib/` contains no Netlify, no
Vercel, no AWS, no database, no filesystem writes. `auditSite(url)` takes a
string and returns an object. Everything host-shaped lives in `adapters/`, and
the adapters are examples you edit, not a framework you adopt.

The practical consequence: moving hosts costs you one adapter file. That is the
whole migration.

## Install

Unzip it and run the installer:

```sh
unzip site-audit-agent.zip
cd site-audit-agent
./install.sh
```

That copies the package to `~/.local/lib/site-audit-agent` and puts a
`site-audit` command in `~/.local/bin`. It fetches nothing, compiles nothing, and
contacts no registry — the whole tool is the files you just unzipped. It runs
`site-audit --version` at the end, so a "success" message means the thing
actually executed.

Install somewhere else if you prefer:

```sh
PREFIX=/usr/local sudo ./install.sh   # system-wide
BIN_DIR=~/bin ./install.sh            # symlink somewhere else
```

Uninstall is `rm -rf ~/.local/lib/site-audit-agent ~/.local/bin/site-audit`.
There is no uninstaller and no state anywhere else on the machine.

### Without the installer

There is nothing magic about it. Copy the folder into your project and run
`bin/audit.mjs` directly — that is a complete install:

```
your-project/
└── site-audit-agent/
    ├── bin/audit.mjs
    ├── lib/
    ├── adapters/
    └── test/
```

Or link it as an npm package, which works because `package.json` declares the
`site-audit` bin:

```sh
cd site-audit-agent && npm link
```

Requires Node 18 or newer (for global `fetch`). Verify with `node --version`.

## Use it

### Command line

```sh
node bin/audit.mjs example.com
node bin/audit.mjs https://example.com --format markdown --out audit.md
node bin/audit.mjs example.com --format json | jq '.score'
node bin/audit.mjs http://localhost:8080 --allow-private --max-pages 5
```

| Option | Default | What it does |
| --- | --- | --- |
| `--format <text\|json\|markdown>` | `text` | Output format |
| `--out <file>` | stdout | Write to a file instead |
| `--max-pages <n>` | 25 | Internal pages to crawl |
| `--concurrency <n>` | 5 | Parallel requests while crawling |
| `--timeout <ms>` | 8000 | Per-request timeout |
| `--slow <ms>` | 2500 | Homepage latency counted as slow |
| `--user-agent <string>` | `site-audit-agent/1.0` | User-Agent sent |
| `--allow-private` | off | Permit localhost / private IPs |
| `--fail-on <failed\|warning\|never>` | `failed` | Severity that exits non-zero |

Exit codes: `0` clean, `1` problems at or above the threshold, `2` could not run.
That makes it usable as a build gate — `--fail-on warning` for a strict one.

### As a library

```js
import { auditSite } from './site-audit-agent/lib/audit.mjs'
import { toMarkdown } from './site-audit-agent/lib/report.mjs'

const report = await auditSite('https://example.com', { maxPages: 10 })

console.log(report.score)            // 0-100
console.log(report.status)           // 'healthy' | 'degraded' | 'unhealthy'
console.log(report.checks)           // [{ name, status, detail }, ...]
console.log(toMarkdown(report))
```

`auditSite` throws `UnsafeUrlError` for a rejected target and otherwise never
throws — an unreachable site comes back as a report with a failed `Reachable`
check, not an exception.

## What it checks

Sixteen checks, every one of them true of any commercial website. Nothing here
assumes a particular CMS, framework, platform, or URL scheme.

| Check | Why it costs you money when it fails |
| --- | --- |
| Reachable | The site is up, and how long the homepage takes |
| HTTPS | Plain http is penalised by search engines and flagged by browsers |
| HTTP redirect | http:// should redirect to https, not serve in parallel |
| Page title | The headline in every search result |
| Meta description | Missing means the search engine invents your ad copy |
| Canonical URL | Duplicate URLs competing with each other for the same ranking |
| Mobile viewport | Without it the site renders zoomed-out on phones |
| Social preview | No Open Graph tags means shared links show no title or image |
| Structured data | No JSON-LD means no rich results and no AI answer-engine grounding |
| Security headers | HSTS, CSP, nosniff, Referrer-Policy |
| robots.txt | Present, and not accidentally blocking the entire site |
| Sitemap | Exists, is valid XML, and lists URLs |
| Sitemap accuracy | Pages you can reach by clicking that the sitemap omits |
| 404 handling | A soft 404 lets search engines index infinite junk URLs |
| Internal links | Dead links, with the failing URL and status |
| Image alt text | Accessibility, and image search |

A `failed` check costs more of the score than a `warning`, and both are weighted
against how many checks actually ran, so a short audit is not flattered.

## Run it on a schedule

Three adapters in `adapters/`, in ascending order of independence.

### GitHub Actions — `adapters/github-actions.yml`

The best default. Free on public repositories, no server to maintain, the report
lands in the run summary and as a downloadable artifact, and a failing audit shows
up as a red run. Copy to `.github/workflows/site-audit.yml` and set an
`AUDIT_TARGET` repository variable.

Requests this job makes to your site are ordinary visitor traffic.

### Netlify scheduled function — `adapters/netlify-scheduled-function.mts`

Convenient if your site is already on Netlify, with one cost caveat worth
understanding before you enable it: a scheduled function is billed per
invocation, **and every request it makes back to your own site is billed again as
an inbound request**. A 25-page audit is roughly 31 billed events per run — about
930 a month daily, or 22,000 a month hourly. The adapter ships with a daily
schedule and a 15-page budget for exactly this reason. If you want it more often,
run it from GitHub Actions instead.

### Plain cron — `adapters/cron.sh`

The floor: a POSIX shell script and Node. A $4 VPS, a Raspberry Pi, a spare
laptop, a shell account. No CI provider, no serverless host, no account anywhere.
If every hosted service named in this README disappeared tomorrow, this one would
still run.

```sh
chmod +x adapters/cron.sh
crontab -e
# 07:23 daily
23 7 * * * AUDIT_TARGET=https://yoursite.com /path/to/adapters/cron.sh
```

It writes timestamped JSON and markdown reports, prunes to the newest 30, and
exits non-zero when the site is unhealthy so cron's `MAILTO` picks it up.

As a systemd timer instead:

```ini
# /etc/systemd/system/site-audit.service
[Unit]
Description=Site audit

[Service]
Type=oneshot
Environment=AUDIT_TARGET=https://yoursite.com
ExecStart=/path/to/adapters/cron.sh

# /etc/systemd/system/site-audit.timer
[Unit]
Description=Daily site audit

[Timer]
OnCalendar=*-*-* 07:23:00
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl enable --now site-audit.timer
```

## Notifications

`lib/notify.mjs` posts a report to any webhook URL — Slack, Discord, Zapier, or
your own endpoint. It sends both `text` and `content` fields, so one payload works
with all of them. No mail provider, no account, no API key.

```js
import { notify } from './lib/notify.mjs'
await notify(report, process.env.AUDIT_WEBHOOK, { when: 'problems' })
```

`when: 'problems'` stays silent on a healthy site, which is what you want from a
nightly job. It never throws — a failed notification will not turn a successful
audit into a failed one.

## Safety

The engine fetches whatever URL it is handed, which is the exact shape of a
Server-Side Request Forgery primitive. Harmless on a laptop; not harmless the
moment you put it behind an HTTP endpoint.

So `lib/url-safety.mjs` refuses, by default:

- loopback (`127.0.0.0/8`, `::1`) and `localhost`
- private ranges (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`, `fe80::/10`)
- link-local `169.254/16`, which includes the **cloud metadata endpoint** at
  `169.254.169.254` — the classic way to steal instance credentials
- `metadata.google.internal` and friends
- carrier-grade NAT (`100.64/10`), `0.0.0.0/8`
- `.local`, `.internal`, `.localdomain` suffixes and dotless hostnames
- any scheme that is not http or https
- URLs carrying a username or password

`--allow-private` waives this, and exists for auditing a dev server on your own
machine. Do not set it on an endpoint that accepts a URL from anyone else.

The guard is applied to **every link the crawler discovers**, not only the entry
point — a page on the audited site can link to `127.0.0.1`, and following that
would reopen the hole.

## Tests

```sh
npm test        # or: node test/run.mjs
```

Thirteen tests using the built-in `node:test`, run against a local fixture server
on an ephemeral port. Nothing touches the public internet, so the suite works
offline and in CI. There are two fixture sites: one deliberately broken (the
engine must find every planted defect) and one correct (the engine must not
invent problems).

## Design notes

**Regex, not a DOM parser.** A real parser is a dependency, and these checks need
presence and content of a handful of `<head>` elements. The regexes are permissive
about attribute order and quoting.

**The crawl is bounded, deliberately.** An unbounded crawl of a large catalog is
slow, and on a metered host it is also expensive. The batch size is clamped to the
remaining page budget rather than merely checked inside the batch — otherwise the
whole batch starts before any of it finishes and the budget overruns.

**Missing `alt` counts, empty `alt` does not.** `alt=""` is the correct markup for
a decorative image; only an absent attribute is a defect.

**Sitemap accuracy is one-directional.** Pages reachable by following links but
absent from the sitemap are the actionable gap. A URL in the sitemap that was not
crawled may simply be beyond the page budget, so it is not reported as an error.

## License

See `LICENSE.md`. One purchase, perpetual use, no subscription, no seat count, no
phone-home, no expiry.
