-- Meridian Gate (AI-HOST-002): outbound lock on the same machine as Host.
-- Category host (Host Packs), niche stores. Not an agent, not Host.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-HOST-002', 'Meridian Gate', 'host', 'stores', '.zip · outbound AI proxy · one-time license', 59.00, 'Sits in front of every AI call on the same machine as Host. Customer data and Stripe keys do not leave unless you say so. Default is no. A receipt for what left.', 'Same Pi / laptop as Host · outbound proxy · witness log · named human')
ON CONFLICT (sku) DO NOTHING;
