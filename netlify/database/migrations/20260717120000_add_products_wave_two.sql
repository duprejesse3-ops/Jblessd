-- Adds a second wave of products to the catalog. This is a roll-forward
-- migration: it never touches the earlier seed, it only inserts new SKUs.
-- ON CONFLICT (sku) DO NOTHING keeps it idempotent and lets it coexist with
-- both the founding catalog and any products owners have listed themselves.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-PP-021', 'Prompt Debugging Playbook', 'prompts', 'developers', '40 prompts + failure taxonomy · PDF', 21, 'Diagnose and repair prompts that drift, hallucinate, or quietly ignore your instructions.', 'Before/after templates for Claude & GPT'),
  ('AI-AG-022', 'Inbox Negotiator Agent', 'agents', 'sales', 'Agent config + guardrails', 38, 'Handles the back-and-forth on pricing and scheduling, then hands off the moment a human is needed.', 'Escalation rules + tone controls'),
  ('AI-TP-023', 'AI Product Spec Template', 'templates', 'founders', 'Notion + Markdown template', 17, 'Turn a rough idea into a build-ready spec your team and your coding agents can both follow.', 'Agent-readable, copy-paste ready'),
  ('AI-AB-024', 'Meeting-to-CRM Automation', 'automations', 'sales', 'Make.com blueprint', 31, 'Pushes call notes, next steps, and the right deal stage into your CRM before you leave the call.', 'HubSpot + Salesforce + Notion'),
  ('AI-PP-025', 'Viral Hook Prompt Pack', 'prompts', 'marketers', '60 hook formulas · PDF + Notion', 23, 'Scroll-stopping opening lines, tuned to the rhythm of each platform.', 'TikTok, Reels, X & LinkedIn presets'),
  ('AI-AG-026', 'Personal Research Analyst', 'agents', 'students', 'Scheduled agent config', 29, 'A standing agent that tracks a topic and briefs you every week with sources, not guesses.', 'Scheduled runs + citation checks'),
  ('AI-TP-027', 'Investor Update Template', 'templates', 'founders', 'Notion + email template', 15, 'A monthly update that keeps investors warm, metrics honest, and your asks impossible to miss.', 'Metrics block + clear ask section'),
  ('AI-AB-028', 'Release Notes Bot', 'automations', 'developers', 'GitHub Actions blueprint', 27, 'Turns merged pull requests into human release notes and a customer-ready changelog.', 'GitHub + Linear + Slack'),
  ('AI-PP-029', 'Voice & Tone Cloner', 'prompts', 'writers', '25 prompts · interview-to-styleguide', 19, 'Capture any brand or personal voice into a reusable system prompt you can hand to any model.', 'Outputs a drop-in style guide'),
  ('AI-AG-030', 'Customer Churn Sentinel', 'agents', 'founders', 'Agent config + save-plays', 43, 'Watches usage and support signals and flags at-risk accounts while there is still time to save them.', 'Signal scoring + outreach prompts')
ON CONFLICT (sku) DO NOTHING;
