-- Adds Meridian Host (AI-HOST-001) for store owners leaving Netlify/Shopify/rented hosts.
-- Deliverable is the host pack (zip): their GitHub, their Stripe, their machine.
-- Not a copy of the MultiNicheAI catalog. Category connectors, niche stores.
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-HOST-001', 'Meridian Host', 'connectors', 'stores', '.zip · Pi / laptop host pack · one-time license', 99.00, 'For store owners leaving Netlify, Shopify, and rented hosts. Load your GitHub on a Pi or laptop, paste your Stripe key, take money on hardware you own. Not a copy of MultiNicheAI''s catalog.', 'One pack · your repo · your Stripe · Pi 4/5 64-bit or Kali/Debian/Ubuntu · firewall 22/80/443')
ON CONFLICT (sku) DO NOTHING;
