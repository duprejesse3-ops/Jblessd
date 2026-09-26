-- Adds an optional `llm_compatibility` column to products, mirroring the
-- time_saved pattern (see 20260924190000_add_time_saved_and_local_seo_product):
-- nullable and additive, existing rows untouched until backfilled. The
-- storefront only renders a "Compatible LLM" additionalProperty in Product
-- JSON-LD when this is present — never a fabricated per-SKU claim.
--
-- Backfill logic, not a blanket value:
--
-- 1) The storefront FAQ already makes a public claim: "The prompt packs and
--    agent configs are built to work with Claude, ChatGPT, and Gemini." That
--    claim is applied as the default for category IN ('prompts', 'agents')
--    only — it is not extended to automations, templates, connectors or host
--    packs, which the FAQ says nothing about and which are frequently
--    platform integrations (Make.com, Zapier, GitHub Actions) rather than
--    LLM-driven tools.
--
-- 2) Where a product's own spec/blurb already names a narrower, specific
--    target, that overrides the blanket default:
--      - Meeting Notes Agent (Claude Projects) and Daily Standup Bot (Slack +
--        Claude API) are Claude-specific by design, not "any of the three".
--      - File Organizer Agent's spec says its optional AI fallback reads
--        ANTHROPIC_API_KEY only — not ChatGPT or Gemini — so it gets a
--        narrower, accurate value instead of the category default.
--      - Incident Postmortem Automation (an "automations" product, so it
--        would otherwise get no value at all) explicitly calls "your own
--        Claude API key" in its blurb, so it gets Claude specifically.
--
-- 3) MultiVault's own copy says plainly "no embeddings, no AI model involved
--    in ranking" — claiming any LLM compatibility for it would misstate the
--    product, so it (and everything else outside prompts/agents without a
--    named override) is left NULL and emits no property at all.

ALTER TABLE products ADD COLUMN IF NOT EXISTS llm_compatibility text;

UPDATE products
SET llm_compatibility = 'Claude, ChatGPT & Gemini'
WHERE category IN ('prompts', 'agents');

UPDATE products SET llm_compatibility = 'Claude' WHERE sku IN ('AI-AG-003', 'AI-AG-008', 'AI-AB-037');

UPDATE products SET llm_compatibility = 'Claude (optional — bring your own ANTHROPIC_API_KEY)' WHERE sku = 'AI-AG-120';
