-- Adds SWARM Intent Autopilot (AI-AB-070) to the catalog.
--
-- Automation for Store & Site Owners. Installed app (Chrome/Edge PWA on
-- Android and Windows) plus GitHub source. Autopilot hijacks existing
-- demand, spawns proof-first organisms, evolves winners. Local genome —
-- no API spend. Not a Google Ads account.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AB-070', 'SWARM Intent Autopilot', 'automations', 'stores', 'Installed app · GitHub source · one-time license', 79.00, 'Hijacks demand that already exists and evolves proof-first ads on autopilot. Maps a pain-utterance to a SKU, spawns eight organisms, kills losers. Not a Google Ads account.', 'Chrome/Edge PWA · Android + Windows · local genome · copy-ready packets')
ON CONFLICT (sku) DO NOTHING;
