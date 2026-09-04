-- Adds MultiVault (AI-CN-008) to the catalog.
--
-- Filed under the existing 'connectors' category and 'founders' niche, same
-- as MultiWitness (AI-CN-006) and MultiGuard (AI-CN-007) — same downloadable
-- app, one-time-license pattern, same real-source delivery already wired up
-- in netlify/lib/deliverables.mts (SKU_DELIVERABLES['AI-CN-008']) and
-- netlify/lib/multivault-source.mts, which embeds the actual product from
-- packages/multivault. This migration is what makes the SKU those already
-- reference actually exist in the live catalog — the storefront reads
-- products from this table directly (see netlify/lib/db.mts loadCatalog()),
-- not from the bundled fallback catalog, so a product only appears live once
-- it has a row here.
--
-- Priced in line with MultiWitness ($69) for comparable complexity: a real
-- local encryption layer plus folder/calendar scanning, versus MultiWitness's
-- hash-chained log.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-CN-008', 'MultiVault', 'connectors', 'founders', '.zip download · zero dependencies · perpetual license · optional standalone binary', 69, 'A local, encrypted context snapshot of one folder and one calendar file — turned into a pasteable brief for any AI chat, or piped into your own scripts. No account, no OAuth, no cloud storage: the vault lives on your machine and only your passphrase opens it.', 'AES-256-GCM · scrypt-derived key · cron/launchd/Task Scheduler adapters included')
ON CONFLICT (sku) DO NOTHING;
