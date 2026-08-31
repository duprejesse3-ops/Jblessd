-- Adds a new 'connectors' category and the 5 MultiConnect products under it.
--
-- 'connectors' is now a first-class category (see netlify/lib/catalog.mts,
-- Index.html chips + filter dropdown + JS CAT_LABEL/SKU-prefix map, and
-- create-custom-checkout-session.mts's VALID_CATEGORIES) rather than reusing
-- 'agents' the way AI-AG-065 (Site Audit Agent) did before this category
-- existed.
--
-- MultiConnect products are standalone downloadable apps that connect a
-- customer's agent (MultiAgents, multiNicheAI, etc.) to an outside service —
-- delivered as real software under a one-time/perpetual license, same as
-- AI-AG-065, just filed under their own category now.
--
-- SKU prefix CN, starting at AI-CN-001.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-CN-001', 'MultiConnect: Zapier/Webhook Bridge', 'connectors', 'developers', 'Downloadable app · one-time license', 29, 'Connect your AI agent to thousands of apps — no code required. Send updates out and receive triggers in via Zapier or Make.', 'Outbound + inbound webhooks · visual payload mapping · live test console'),
  ('AI-CN-002', 'MultiConnect: Shopify', 'connectors', 'stores', 'Downloadable app · one-time license', 59, 'Give your AI agent real-time access to your Shopify store — inventory, orders, and instant triggers, all in sync.', 'Product/inventory sync · order visibility · webhook triggers · read-only or read/write mode'),
  ('AI-CN-003', 'MultiConnect: Sheets/Airtable', 'connectors', 'office', 'Downloadable app · one-time license', 35, 'Turn a spreadsheet into your agent''s database. Two-way sync with Google Sheets or Airtable — no code needed.', 'Row read/write · column mapping · two-way sync · Sheets + Airtable in one app'),
  ('AI-CN-004', 'MultiConnect: Email/CRM', 'connectors', 'sales', 'Downloadable app · one-time license', 79, 'Let your agent handle email and contacts — safely. Draft, send, and follow up on leads with full approval control.', 'Read/draft/send · CRM contact sync · inbound-triggered tasks · approval queue + send limits'),
  ('AI-CN-005', 'MultiConnect: Slack/Discord', 'connectors', 'office', 'Downloadable app · one-time license', 25, 'Bring your AI agent into the channels you already use. Automated updates, alerts, and commands in Slack or Discord.', 'Channel updates/alerts · slash-command support · per-event channel routing · Slack + Discord')
ON CONFLICT (sku) DO NOTHING;
