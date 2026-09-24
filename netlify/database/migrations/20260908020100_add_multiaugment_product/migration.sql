-- Adds MultiAugment (AI-AG-113) to the catalog.
--
-- Built on Intelligence Augmentation (IA) — a real, decades-old concept
-- standing in deliberate contrast to AI: a tool meant to sharpen a human's
-- own judgment rather than replace it. Concretely: on a genuine judgment
-- call, it presents real options with honest tradeoffs instead of one
-- confident verdict, states plainly when it's unsure rather than filling
-- the gap with confident-sounding filler, never claims to have executed
-- anything on the buyer's behalf, and closes every answer with an explicit
-- "WHO DECIDES:" line naming whose call it actually is. Not indecisiveness
-- by default — a question with one correct answer still gets answered
-- directly; the discipline is scoped to real judgment calls specifically.
-- See SKU_RUN_BRIEF in product-app.mts for the enforced rule.
--
-- Multi-branded (category stays 'agents', not 'connectors') — same
-- precedent as MultiAgents and MultiCascade: isSoftwareProduct() in
-- Product-image.mts matches on category OR a Multi[A-Z] name.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-113', 'MultiAugment', 'agents', 'office', 'System prompt + decision framework', 39, 'Flips the usual AI move on purpose — instead of a confident verdict, it shows the real tradeoffs, says plainly what it''s unsure about, and ends every answer by naming whose call this actually is. Never executes anything on your behalf either — it prepares the move and hands it back for you to make.', 'Real options over one verdict · flags its own uncertainty · never acts without a go-ahead · every answer ends with WHO DECIDES')
ON CONFLICT (sku) DO NOTHING;
