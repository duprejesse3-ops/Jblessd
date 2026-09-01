-- Adds MultiWitness (AI-CN-006) to the catalog.
--
-- Filed under the existing 'connectors' category rather than a new one:
-- MultiWitness is the audit layer that sits across the other MultiConnect
-- products, and reuses the same downloadable-app, one-time-license pattern
-- as AI-CN-001 through AI-CN-005 — it doesn't need its own category to make
-- that clear.
--
-- Priced above the other connectors (except Email/CRM) because it's the
-- foundational trust layer for the whole line, not a single-service
-- integration.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-CN-006', 'MultiWitness', 'connectors', 'founders', 'Downloadable app · one-time license', 69, 'A tamper-evident, hash-chained log of what your AI agents actually did — proof you can hand to anyone, checkable without trusting a server.', 'Zero deps · SHA-256 hash chain · offline CLI verify')
ON CONFLICT (sku) DO NOTHING;
