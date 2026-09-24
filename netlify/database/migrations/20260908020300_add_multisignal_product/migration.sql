-- Adds MultiSignal (AI-AG-115) to the catalog.
--
-- Correlates an internal business signal (a number the buyer supplies —
-- support volume, churn, spend, whatever moved) against two independently
-- fetched external sources: recent headlines and real Reddit discussion —
-- see netlify/lib/multisignal-live-context.mts. Both genuinely free, no
-- API key, no paid tier, same scope decision as $Odds Agent's live news.
--
-- Same honest-correlation family as $Token Agent's "NO TRADE" and $Odds
-- Agent's "NO FLAG": manufacturing a connection to look useful is a
-- failure, not caution — "NO LINK" is this product's version of that
-- same discipline. Also requires an explicit timing check (does the
-- external signal actually precede or coincide with the internal change,
-- not just correlate by coincidence) and a stated confidence level rather
-- than ever implying proven causation — see SKU_RUN_BRIEF in
-- product-app.mts for the enforced rule.
--
-- Multi-branded (category stays 'agents', not 'connectors') — same
-- precedent as MultiCascade and MultiAugment.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-115', 'MultiSignal', 'agents', 'founders', 'System prompt + live signal fetch', 46, 'Give it a number that moved inside your business and it checks the outside world itself — live headlines and real Reddit discussion — for a plausible connection, timing checked, confidence stated, never dressed up as proof. When nothing outside actually connects, it says so instead of forcing a story.', 'Fetches headlines + Reddit discussion automatically · timing-checked, not just correlated · NO LINK is a valid run · never claims proof, only plausibility')
ON CONFLICT (sku) DO NOTHING;
