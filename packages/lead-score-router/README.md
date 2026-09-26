# Lead Score & Router

Scores every new inbound lead against your ideal customer profile with
Claude, decides which tier it falls into, and posts it straight to the
right Slack channel — hot leads somewhere your reps actually watch, warm
leads to nurture, everything else logged and left alone. Not a Make/Zapier
blueprint you assemble yourself — a working script that reads, scores, and
routes from the first run.

## How this differs from a scoring *spreadsheet*

A spreadsheet formula can weight a couple of fields you remembered to fill
in. This script reads the whole lead — company, title, their actual
message — and asks Claude to judge it against a plain-English description
of your ideal customer, the way a rep skimming the inbox would, then acts
on that judgment immediately by posting to Slack. It also remembers which
leads it's already routed, so re-running against the same export never
posts the same lead twice.

## What it does, precisely

1. Reads `leads.json` — an array of lead objects, each with a stable `id`
   (email works fine) plus whatever fields your form or CRM export
   already has (name, company, title, message, source).
2. For each lead not already in `state.json`, it builds a scoring prompt
   from your `config.json` ICP description and that lead's fields, and
   sends it to Claude.
3. Claude replies with a score (0-100) and a one-line reason, which this
   script parses back out.
4. The score is matched against your configured tiers (e.g. Hot ≥ 80,
   Warm ≥ 50, Nurture ≥ 0) — highest qualifying tier wins.
5. If that tier has a Slack webhook configured, a message naming the tier,
   score, reason, and the lead's own fields is posted there. A tier with no
   webhook is logged to the console only — a deliberate "don't route this
   one anywhere" config, not a failure.
6. Records the lead's ID, score, and tier in `state.json` so it's never
   routed again on a future run.

It does not write to a CRM, send an email, or take any action beyond the
Slack post — pick that up from the Slack notification, or extend
`bin/route.mjs` (plain JavaScript, no build step) to add your own next
step.

## Install (10 minutes)

1. Copy `bin/`, `lib/`, and `config.example.json` into your repo — anywhere,
   e.g. `tools/lead-score-router/`.
2. Copy `config.example.json` to `config.json` and edit `icpDescription`
   to describe your actual ideal customer, plus your real tier thresholds
   and Slack webhook URLs (Slack → Apps → Incoming Webhooks, one per
   channel you want a tier routed to; leave a tier's `webhookUrl` blank to
   log that tier only).
3. Copy `.github-workflow-template/lead-score-router.yml` to
   `.github/workflows/lead-score-router.yml` (this exact path — GitHub only
   runs workflows from there).
4. If you put `bin/`/`lib/` somewhere other than `tools/lead-score-router/`,
   edit the `working-directory:` lines in the workflow to match.
5. Add the repo secret (**Settings → Secrets and variables → Actions**):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com/settings/keys
6. Wire your own step to write a fresh `leads.json` before this runs (an
   export from your form tool or CRM) — this script scores what's already
   in the file, it doesn't fetch leads from anywhere itself.
7. Commit and push. Trigger it once immediately from the **Actions** tab
   (`workflow_dispatch`) with `leads.example.json` copied to `leads.json`
   to check it actually works.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in ANTHROPIC_API_KEY
cp config.example.json config.json   # edit with your real ICP and tiers
cp leads.example.json leads.json     # or your own real export
node bin/route.mjs
```

```sh
npm test
```
Runs without any real API key, network call, or live Slack post — checks
config validation, tier selection, prompt construction, labeled-response
parsing (including score clamping), the Slack message builder, and the
dedupe state, not a live Claude call or a real webhook post.

## On state.json

This product tracks, per lead ID, the score and tier it was routed to —
that's the entire job of `state.json`, and it's the only state this
product keeps. It's a plain JSON file, not a database, so you can read it,
edit it, or delete a lead's entry by hand to force it to be re-scored on
the next run. If `state.json` goes missing entirely, the next run treats
every lead in `leads.json` as new.

## License

See `LICENSE.md`. One-time purchase, for your own use — run it against
unlimited leads and Slack workspaces, not for resale as a standalone
product.
