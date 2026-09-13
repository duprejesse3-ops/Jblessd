# Code Review Digest

A GitHub Actions workflow that posts a real, prioritized PR digest to Slack
on a schedule. Not a blueprint you wire yourself in an automation tool — an
actual `.yml` workflow that runs itself once it's in your repo.

## What it does, precisely

1. On a schedule (default: 14:00 UTC weekdays — edit the cron in the
   workflow), it lists every open PR via GitHub's API.
2. For each one it pulls the latest review state, age, and last-updated time.
3. Claude turns that into a digest that actually prioritizes — "these 3 need
   a human, these 2 are fine to leave" — not a flat list in PR-number order.
4. Posts it to Slack as a real Block Kit message.

It does not review code itself, approve/block PRs, or replace a human
reviewer. It tells you where to look.

## Install (5 minutes)

1. Copy `bin/` and `lib/` into your repo — anywhere, e.g.
   `tools/code-review-digest/`.
2. Copy `.github-workflow-template/code-review-digest.yml` to
   `.github/workflows/code-review-digest.yml` (this exact path — GitHub only
   runs workflows from there).
3. If you put `bin/`/`lib/` somewhere other than `tools/code-review-digest/`,
   edit the `working-directory:` line in the workflow to match.
4. Add two repo secrets (**Settings → Secrets and variables → Actions**):
   - `ANTHROPIC_API_KEY` — your own key from console.anthropic.com
   - `SLACK_WEBHOOK_URL` — Slack → Apps → Incoming Webhooks
5. Commit and push. It runs on the schedule automatically, or trigger it once
   immediately from the **Actions** tab (`workflow_dispatch`) to check it
   actually works before waiting for the cron.

`GITHUB_TOKEN` needs no secret of its own — Actions provides it, scoped
read-only by the `permissions:` block already in the workflow.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in ANTHROPIC_API_KEY, SLACK_WEBHOOK_URL
GITHUB_TOKEN=ghp_your_own_token GITHUB_REPOSITORY=you/your-repo node bin/digest.mjs
```

`GITHUB_TOKEN` here can be a personal access token with `repo` read scope —
just for local testing; inside Actions itself you never create or store one.

```sh
npm test
```
Runs without real API keys — checks the Slack formatter and error handling,
not a live GitHub/Claude call.
