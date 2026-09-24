-- Adds $Odds Agent (AI-AG-114) to the catalog.
--
-- A sibling to $Token Agent (AI-AG-094), same finance niche, same
-- honest-risk-framing family, genuinely different mechanic: checks a
-- named prediction market for real-time divergence between its own
-- probability estimate and the market's current price, reasoning shown,
-- rather than $Token Agent's periodic equity-research shortlist.
--
-- Fetches its own live context before running (see
-- netlify/lib/odds-live-context.mts): current price from Polymarket's
-- public Gamma API, recent headlines from Google News RSS search — both
-- genuinely free, no API key, no paid tier, a deliberate scope decision.
-- Falls back honestly to the buyer's own typed price and general
-- knowledge if either live fetch fails or wasn't attempted (no
-- Polymarket URL given) — see SKU_RUN_BRIEF's live-context lock.
--
-- Built specifically against the hype-bait "autonomous trading bot" genre
-- of social content — no autonomous execution, ever. "NO FLAG is a valid
-- run" mirrors $Token Agent's "NO TRADE is a valid run": manufacturing a
-- signal to look useful is treated as a failure, not caution.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-114', '$Odds Agent', 'agents', 'finance', 'System prompt + divergence watch template', 44, 'Paste a Polymarket link and it checks the live price and recent headlines itself, then flags a real divergence between the public case and the price — never a trade. Most people who think they have a real edge on these markets don''t; this is built to help you find out, not promise you one.', 'Fetches live price + headlines automatically · flags real divergence, not noise · NO FLAG is a valid run · never places a trade')
ON CONFLICT (sku) DO NOTHING;
