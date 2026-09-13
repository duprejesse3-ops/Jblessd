-- Updates the three "GitHub Actions blueprint" listings (AI-AB-013,
-- AI-AB-028, AI-AB-034) to what they actually are now: real workflow files.
--
-- Same situation as AI-AB-037 (see 20260912200000_incident_postmortem_
-- becomes_real_automation.sql): "GitHub Actions blueprint" meant a
-- description of what to build, not a .yml file that runs itself. All three
-- now ship as real source under packages/, delivered as .zip via the same
-- archive pipeline as AI-AB-037 and AI-AG-065 — see
-- netlify/lib/product-archive.mts.
--
-- Prices unchanged. Uses UPDATE, not INSERT ... ON CONFLICT DO NOTHING,
-- because these rows already exist live.

UPDATE products
SET
  blurb = 'A real workflow that posts a prioritized PR digest to Slack on a schedule — not a blueprint you wire yourself. Flags what needs a human today, says so plainly when nothing does.',
  format = '.zip · real GitHub Actions workflow, Slack included · one-time license',
  spec = 'GitHub Actions (scheduled) + GitHub API + Slack Block Kit · Node 18+, zero dependencies'
WHERE sku = 'AI-AB-013';

UPDATE products
SET
  blurb = 'A real workflow that fires when you publish a GitHub Release: drafts customer-facing notes and an internal Slack summary from your actual merged PRs, commits CHANGELOG.md, sets the release body. Not a blueprint you wire yourself.',
  format = '.zip · real GitHub Actions workflow, commits your changelog · one-time license',
  spec = 'GitHub Actions (release-triggered) + GitHub compare API + Slack · commits to your repo'
WHERE sku = 'AI-AB-028';

UPDATE products
SET
  blurb = 'A real workflow that regenerates a Mermaid diagram from your codebase''s actual structure on every push to main — grounded in a real scan, nothing invented. Commits only when it genuinely changed. Not a blueprint you wire yourself.',
  format = '.zip · real GitHub Actions workflow, commits the diagram · one-time license',
  spec = 'GitHub Actions (push-triggered) + regex-based import scan + Mermaid · zero dependencies'
WHERE sku = 'AI-AB-034';
