# Release Notes Bot

A GitHub Actions workflow that turns merged pull requests into real release
notes and a changelog entry the moment you publish a GitHub Release —
committed to `CHANGELOG.md`, posted to Slack, and set as the release body.
Not a blueprint you wire yourself.

## What it does, precisely

1. On **Release → published**, finds every PR merged since the previous tag
   (via GitHub's compare API — no manual "what changed" step).
2. Picks up a Linear issue key (`ENG-123` style) from the PR title or branch
   name, if one is there.
3. Claude drafts two things from that list: a **customer-facing** changelog
   entry (plain language, no PR numbers) and an **internal** Slack summary
   (can reference PR numbers and authors).
4. Prepends the customer entry to `CHANGELOG.md` and commits it.
5. Sets that same entry as the GitHub Release's notes.
6. Posts the internal summary to Slack.

## Install (5 minutes)

1. Copy `bin/` and `lib/` into your repo, e.g. `tools/release-notes-bot/`.
2. Copy `.github-workflow-template/release-notes-bot.yml` to
   `.github/workflows/release-notes-bot.yml`.
3. If you used a different location than `tools/release-notes-bot/`, edit the
   `working-directory:` lines in the workflow to match.
4. Add two repo secrets:
   - `ANTHROPIC_API_KEY`
   - `SLACK_WEBHOOK_URL`
5. Publish a GitHub Release like normal. The workflow runs automatically —
   nothing else to trigger.

`GITHUB_TOKEN` needs no secret of its own, but this workflow needs
`contents: write` (already set in the template) since it commits the
changelog and edits the release — a broader permission than
code-review-digest or architecture-diagram-sync need, because those only
read.

If your default branch isn't `main`, change `git push origin HEAD:main` in
the workflow's "Commit CHANGELOG.md" step.

## Testing without waiting for a real release

```sh
npm install --omit=dev
cp .env.example .env
GITHUB_TOKEN=ghp_your_own_token GITHUB_REPOSITORY=you/your-repo \
  node bin/release-notes.mjs v1.1.0 v1.2.0
```

Pass an empty string as the first argument to simulate a first release (no
previous tag to compare against):
```sh
node bin/release-notes.mjs "" v1.0.0
```

```sh
npm test
```
Runs without real API keys.
