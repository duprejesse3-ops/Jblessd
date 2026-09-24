-- Updates Incident Postmortem Automation (AI-AB-037) from a blueprint listing
-- to what it actually is now: real, runnable source.
--
-- Previously "PagerDuty + Slack blueprint" meant the buyer read instructions
-- and wired Make/Zapier/webhooks themselves — true of 12 of the 13 products
-- in the automations category. This one now ships as real code
-- (packages/incident-postmortem-automation/): a signature-verified PagerDuty
-- webhook, a Slack Block Kit poster, and a standalone CLI, calling the
-- buyer's own ANTHROPIC_API_KEY. Delivered as a .zip via the same archive
-- pipeline as site-audit-agent (AI-AG-065) — see
-- netlify/lib/product-archive.mts.
--
-- Price unchanged at $34 — same tier, now meaningfully more product than the
-- listing described.
--
-- Uses UPDATE, not INSERT ... ON CONFLICT DO NOTHING, because the row
-- already exists live.
UPDATE products
SET
  blurb = 'Turns an incident timeline into a blameless postmortem draft with owners assigned — automatically, on incident.resolved. Not a blueprint you wire yourself: a real webhook, a real Slack poster, and a CLI for one-off drafts, calling your own Claude API key.',
  format = '.zip · real PagerDuty webhook + Slack, CLI included · one-time license',
  spec = 'PagerDuty webhook (HMAC-verified) + Slack Block Kit + standalone CLI · Node 18+, zero dependencies'
WHERE sku = 'AI-AB-037';
