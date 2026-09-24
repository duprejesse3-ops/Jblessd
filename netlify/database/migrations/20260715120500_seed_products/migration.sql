-- Seed the catalog. Adds a unique index on sku so seeding is idempotent, then
-- inserts the founding catalog plus a new line of flagship AI agent products.
-- ON CONFLICT keeps this safe to (re)apply and lets user-listed products with
-- their own SKUs coexist without collision.
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (sku);

INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-PP-001', 'Deep Work Prompt Pack', 'prompts', 'founders', '120 prompts · PDF + Notion', 19, 'Prompts for prioritization, focus blocks, and end-of-day resets.', 'Works with Claude, ChatGPT, Gemini'),
  ('AI-AB-002', 'Inbox Zero Automation', 'automations', 'sales', 'Make.com blueprint', 29, 'Auto-sorts, drafts replies, and flags what needs a human.', 'Gmail + Outlook compatible'),
  ('AI-AG-003', 'Meeting Notes Agent', 'agents', 'founders', 'System prompt + template', 15, 'Turns raw transcripts into decisions, owners, and deadlines.', 'Tuned for Claude Projects'),
  ('AI-TP-004', 'Weekly Planning Template', 'templates', 'students', 'Notion template', 12, 'A weekly operating rhythm: plan Monday, review Friday.', 'Duplicate-and-go setup'),
  ('AI-AB-005', 'Content Calendar Autopilot', 'automations', 'marketers', 'Zapier blueprint', 24, 'Drafts posts from your notes and queues them by channel.', 'Buffer + Notion + Sheets'),
  ('AI-PP-006', 'Research Assistant Prompts', 'prompts', 'students', '45 prompts · PDF', 22, 'Structured prompts for literature scans and source comparison.', 'Citation-aware formatting'),
  ('AI-TP-007', 'Client Onboarding Kit', 'templates', 'sales', 'Notion + email templates', 34, 'Intake form, welcome sequence, and kickoff checklist in one kit.', 'Editable branding block'),
  ('AI-AG-008', 'Daily Standup Bot', 'agents', 'developers', 'Slack agent config', 18, 'Collects async updates and posts a one-line team digest.', 'Slack + Claude API'),
  ('AI-TP-009', 'OKR Tracker Template', 'templates', 'founders', 'Sheets template', 14, 'Quarterly objectives with auto-calculated confidence scores.', 'Google Sheets, no add-ons'),
  ('AI-AB-010', 'Personal CRM Automation', 'automations', 'sales', 'Make.com blueprint', 25, 'Reminds you to follow up before a relationship goes cold.', 'Contacts + Calendar sync'),
  ('AI-PP-011', 'Writing Style Prompt Kit', 'prompts', 'writers', '30 prompts · PDF', 16, 'Locks tone and voice so drafts sound like you, not a template.', 'Includes 3 worked examples'),
  ('AI-AG-012', 'Financial Categorizer Agent', 'agents', 'founders', 'Sheets + agent config', 27, 'Reads bank exports and sorts spend into categories you define.', 'CSV in, clean ledger out'),
  ('AI-AB-013', 'Code Review Digest', 'automations', 'developers', 'GitHub Actions blueprint', 26, 'Summarizes open PRs into a daily digest with risk flags.', 'GitHub + Slack webhook'),
  ('AI-PP-014', 'Landing Page Copy Prompts', 'prompts', 'marketers', '35 prompts · PDF', 18, 'Headline, hero, and CTA variants tuned for conversion testing.', 'A/B-ready output format'),
  -- New flagship AI products
  ('AI-AG-015', 'Realtime Voice Agent Blueprint', 'agents', 'founders', 'Twilio + Realtime API config', 49, 'A production-ready voice agent that answers calls, books meetings, and hands off to a human.', 'Low-latency streaming, barge-in handling'),
  ('AI-AG-016', 'RAG Knowledge Base Agent', 'agents', 'developers', 'Vector store + retrieval config', 44, 'Turns your docs into a grounded assistant that answers with citations, not guesses.', 'Chunking, embeddings, and reranking presets'),
  ('AI-AG-017', 'Multi-Agent Research Swarm', 'agents', 'students', 'Orchestrator + sub-agent prompts', 39, 'Dispatches parallel research agents, then merges their findings into one sourced brief.', 'Fan-out / synthesize / verify pattern'),
  ('AI-AB-018', 'Support Triage Copilot', 'automations', 'sales', 'Zendesk + Intercom blueprint', 42, 'Reads every inbound ticket, drafts a reply, and routes the hard ones to a human.', 'Sentiment + priority scoring built in'),
  ('AI-PP-019', 'Image Prompt Studio', 'prompts', 'marketers', '80 prompts · gpt-image-1 + Gemini', 28, 'Art-directed prompts for on-brand product shots, ads, and social visuals.', 'Style, lighting, and aspect-ratio recipes'),
  ('AI-AG-020', 'Autonomous SEO Content Agent', 'agents', 'marketers', 'Brief-to-draft agent config', 46, 'Researches keywords, drafts, and internally links a full article on a topic you name.', 'Outline, draft, and on-page SEO passes')
ON CONFLICT (sku) DO NOTHING;
