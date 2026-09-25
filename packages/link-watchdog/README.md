# Broken Link & Uptime Watchdog

Reads your real `sitemap.xml`, checks every URL it lists against your real
site (and, optionally, the outbound links found on those pages), and emails
you an actual digest of what's broken — a real HTTP check, a real email, no
account to sign up for. Not a Make/Zapier blueprint you assemble — a working
script that does the whole job the moment it's configured.

## Why not just pay for a link-checker SaaS?

Because most of what those subscriptions charge monthly for is a cron job
and an inbox. This is that cron job — running on infrastructure you already
have (GitHub Actions, free for a public repo and cheap for a private one),
checking your own site, with no per-page or per-check pricing, no seat limit,
and no dashboard login to remember. You own the script; nothing stops
working if the vendor behind it raises prices or shuts down.

## What it does, precisely

1. On a schedule (default: weekly — edit the cron in the workflow), it reads
   `config.json`: the sitemap to check, who gets the digest, and how wide to
   crawl.
2. It fetches that sitemap (following a sitemap *index* into its child
   sitemaps, if that's what's there) and pulls out every URL it lists.
3. It requests each URL — `HEAD` first, falling back to `GET` for servers
   that don't support `HEAD` — and classifies the result: **ok**,
   **redirect**, **client error (4xx)**, **server error (5xx)**, **timed
   out**, or **unreachable**.
4. If `checkExternalLinks` is on, it also scans the pages that came back OK
   for outbound (off-site) links, and checks up to `externalLinkLimit` of
   those too — so a dead link to a partner's site or an old vendor page gets
   caught as well, not just your own broken pages.
5. Requests are concurrency-limited (`concurrency` in config) so this is a
   polite crawl of your own site, not a denial-of-service against it.
6. It builds a report — counts by error type, and the full list of broken
   URLs with the status/error and which page linked to it — and emails it to
   you via Resend.
7. Optionally posts a one-line run summary to Slack either way — even "ran,
   nothing broken" — so you know the job is alive without checking your
   inbox.

It does not fix anything, edit your site, or guess *why* a link broke — it
tells you exactly what's broken and where it's linked from, so you (or
whoever owns that page) can fix it.

## Install (10 minutes)

1. Copy `bin/`, `lib/`, and `config.example.json` into your repo — anywhere,
   e.g. `tools/link-watchdog/`.
2. Copy `config.example.json` to `config.json` in that same folder and edit
   it: your real sitemap URL, who should receive the digest, and whether to
   check external links.
3. Copy `.github-workflow-template/link-watchdog.yml` to
   `.github/workflows/link-watchdog.yml` (this exact path — GitHub only
   runs workflows from there).
4. If you put `bin/`/`lib/` somewhere other than `tools/link-watchdog/`, edit
   the `working-directory:` line in the workflow to match.
5. Add repo secrets (**Settings → Secrets and variables → Actions**):
   - `RESEND_API_KEY` — from resend.com. **Leave unset to dry-run**: the
     report is still built and logged every run, just never emailed — a safe
     way to watch it for a run or two before it emails your team.
   - `WATCHDOG_FROM_EMAIL` — a verified sending address on your Resend domain
   - `SLACK_WEBHOOK_URL` (optional) — Slack → Apps → Incoming Webhooks
   - `SITE_NAME` (optional) — appears in the email subject/body
6. Commit and push. It runs on the schedule automatically, or trigger it
   once immediately from the **Actions** tab (`workflow_dispatch`) to check
   it actually works before waiting for the cron.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in RESEND_API_KEY, WATCHDOG_FROM_EMAIL, etc.
cp config.example.json config.json   # edit with your real sitemap URL
node bin/watchdog.mjs
```

Leave `RESEND_API_KEY` blank in `.env` for your first run — you'll see
exactly what the digest *would* contain, logged to the console, with nothing
actually sent.

```sh
npm test
```
Runs without any real API keys or network calls — every check (sitemap
parsing, status classification, link extraction, report/email building) runs
against a fake `fetch` you pass in, not a live site or a live Resend call.

## Config reference (`config.json`)

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `sitemapUrl` | yes | — | The sitemap to crawl. A sitemap index is followed automatically. |
| `toEmail` | yes | — | Who receives the digest. |
| `concurrency` | no | `5` | Max requests in flight at once — keep this low on a small host. |
| `checkExternalLinks` | no | `false` | Also check outbound links found on pages that returned OK. |
| `externalLinkLimit` | no | `20` | Caps how many distinct external links get checked, so a page with hundreds of outbound links doesn't turn one run into thousands of requests. |
| `requestTimeoutMs` | no | `8000` | Per-request timeout, in milliseconds. |

## On sites that block HEAD or automated requests

Some servers reply to an automated `HEAD`/`GET` with a 403 that a real
browser would never see (bot-detection middleware, a WAF rule, a
rate-limiter). This tool has no way to distinguish that from a genuinely
broken page — it reports what the server told it. If a URL you know works
in a browser shows up as broken, check it manually before treating it as a
real defect; this is the one class of false positive worth knowing about
going in.

## License

See `LICENSE.md`. One-time purchase, for your own use — run it on unlimited
sites and sitemaps you own or operate, not for resale as a standalone
product.
