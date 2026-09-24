-- Adds a Language & Translation line to the catalog — an AI "host" that
-- breaks the language barrier across three angles: live bidirectional
-- conversation, marketing content localization, and multilingual customer
-- support replies. All three are Agent Configs, so they run live in the
-- store's demo feature: the demo engine (netlify/functions/demo.mts) is
-- fully generative from each product's blurb + spec, so no separate
-- system-prompt storage is needed for the SKU to be immediately
-- demoable — blurb and spec ARE what the live demo is grounded in.
--
-- Like the earlier waves (see 20260722140000_add_products_finance.sql) this
-- is a roll-forward migration: it only inserts new SKUs, and ON CONFLICT
-- (sku) DO NOTHING keeps it idempotent and safe to coexist with whatever
-- else has been added to the catalog since, including SKUs added live
-- through the "List a product" admin form.
--
-- SKU numbers (090-092) are chosen well above the highest number found
-- across every existing migration (065), since the admin form assigns new
-- SKUs from the live database's current max — which may be higher than what
-- any migration file alone shows.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-090', 'AI Language Bridge', 'agents', 'sales', 'System prompt + template', 22, 'Drop this into any chat, call transcript, or live conversation and it translates both directions in real time — keeping tone, urgency, and intent intact, not just literal words.', 'Turn-by-turn translation, either direction, tone-preserving'),
  ('AI-AG-091', 'Global Content Localizer', 'agents', 'marketers', 'System prompt + template', 24, 'Takes your English marketing copy and rebuilds it for a target market — idiom, humor, and cultural reference swapped out, not just translated. Ships back ready to publish, not ready to be corrected.', 'Rewrites for cultural fit, not word-for-word'),
  ('AI-AG-092', 'Multilingual Support Inbox', 'agents', 'sales', 'System prompt + template', 22, 'A customer messages in Portuguese, Japanese, whatever — this drafts your reply in their language, matched to your usual tone, so you never lose a lead to a language gap.', 'Auto-detects language, drafts in-kind')
ON CONFLICT (sku) DO NOTHING;
