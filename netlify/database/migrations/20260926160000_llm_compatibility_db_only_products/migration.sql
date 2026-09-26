-- Extends the llm_compatibility backfill from 20260926110000 to the 14
-- DB-only products that weren't visible in the repo at the time (see
-- 20260926140000_dedupe_file_organizer_and_more_titles). Same rule as
-- before: category IN ('prompts','agents') gets the storefront FAQ's
-- blanket "Claude, ChatGPT & Gemini" claim, UNLESS the product's own
-- format/blurb already names something narrower — in which case the
-- narrower, stated claim wins. Automations and templates are left NULL,
-- same as the first wave.

UPDATE products
SET llm_compatibility = 'Claude, ChatGPT & Gemini'
WHERE sku IN ('AI-AG-016', 'AI-AG-017', 'AI-AG-020', 'AI-AG-022', 'AI-AG-066', 'AI-AG-090', 'AI-AG-091', 'AI-AG-092');

-- Narrower, already-stated targets:
UPDATE products SET llm_compatibility = 'OpenAI Realtime API' WHERE sku = 'AI-AG-015';
UPDATE products SET llm_compatibility = 'gpt-image-1 & Gemini' WHERE sku = 'AI-PP-019';
UPDATE products SET llm_compatibility = 'Claude & GPT' WHERE sku = 'AI-PP-021';
