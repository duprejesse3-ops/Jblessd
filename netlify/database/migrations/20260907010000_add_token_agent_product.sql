-- Adds $Token Agent (AI-AG-094) to the catalog.
--
-- Finance & Investing research instrument. Not a broker and not an
-- auto-trader. Priced with the other $44 finance agents.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-094', '$Token Agent', 'agents', 'finance', 'System prompt + weekly brief template', 44, 'Reads filings, headlines, and trend noise and returns a sourced shortlist — not a trade. You still click the button.', 'Thesis + sources + kill-criteria · NO TRADE is a valid run')
ON CONFLICT (sku) DO NOTHING;
