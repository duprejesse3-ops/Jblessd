# Incident Postmortem Automation

Turns an incident timeline into a blameless postmortem draft — root cause,
impact, and action items with an owner already assigned to each one. Two ways
to use it:

- **`postmortem` CLI** — point it at a timeline file, get a draft back.
  Nothing to deploy.
- **PagerDuty webhook** — wire it to `incident.resolved` and it drafts and
  posts to Slack on its own, no one has to run a command.

Both call Claude once per incident using **your own** `ANTHROPIC_API_KEY` —
billed to your account, nothing routed through the seller.

## Quick start (no PagerDuty needed)

```sh
cp .env.example .env    # fill in ANTHROPIC_API_KEY at minimum
npm install --omit=dev  # no dependencies today, but future-proof
node bin/postmortem.mjs your-timeline.txt
```

`your-timeline.txt` can be anything — a PagerDuty timeline export, a pasted
Slack thread, or plain notes. There's no required format; Claude reads it as
prose.

Post straight to Slack instead of printing:

```sh
node bin/postmortem.mjs your-timeline.txt --slack-webhook https://hooks.slack.com/services/...
```

## Running it as a real automation

This is the part that makes it an automation and not a blueprint: point
PagerDuty at a webhook, and a draft appears in Slack the moment an incident
resolves.

1. **PagerDuty → Integrations → Generic Webhooks (V3)** → add an endpoint,
   subscribed to **Incident Resolved**.
2. Copy the signing secret PagerDuty shows you into `PAGERDUTY_WEBHOOK_SECRET`.
3. **My Profile → User Settings → API Access** → create a read-only API
   token, into `PAGERDUTY_API_TOKEN`. The webhook payload itself only
   contains the incident summary — this token is what lets the tool pull the
   actual timeline of log entries.
4. **Slack → your workspace → Apps → Incoming Webhooks** → create one, into
   `SLACK_WEBHOOK_URL`.

Then pick one way to run it:

**Your own server or Pi** (works well alongside Meridian Host, if you're
already running that):
```sh
node adapters/pagerduty-webhook.mjs
```
PagerDuty needs a public HTTPS URL to reach this. A tunnel (`cloudflared`,
`ngrok`) works for testing; put it behind Caddy/nginx for real use.

**Netlify Function** — no machine to keep running:
1. Copy `adapters/netlify-function.mts` into your own site's
   `netlify/functions/` directory.
2. Set the four environment variables in Netlify's site settings.
3. Point PagerDuty at
   `https://your-site.netlify.app/.netlify/functions/pagerduty-postmortem`.

## What it actually does, precisely

1. PagerDuty sends a webhook the moment an incident is marked resolved.
2. The signature is verified (HMAC-SHA256 against `PAGERDUTY_WEBHOOK_SECRET`)
   before anything else happens — an unverified request is rejected, not
   processed.
3. The incident's log entries are pulled from PagerDuty's API — the real
   timeline of what happened, not just the title.
4. Claude drafts a blameless postmortem: summary, root cause, timeline,
   and action items, each with an owner and a due date.
5. The draft is posted to Slack as a formatted message with a real checklist.

What it does **not** do: fix the underlying issue, create tickets in Jira/
Linear automatically, or page anyone. If you want ticket creation added,
`lib/postmortem.mjs` returns a plain JS object — wiring it to your tracker's
API from there is a small, contained addition, not a rewrite.

## Testing your setup

```sh
npm test
```

Runs without needing real API keys — it checks the JSON shape the drafting
function is expected to produce and that the Slack formatter handles an empty
`actionItems` list without crashing, so a broken environment fails fast and
loud instead of silently drafting nothing.

To test the whole path with a real Claude call:
```sh
node bin/postmortem.mjs test/fixtures/sample-timeline.txt --json
```
