-- Converts the ads network from purely reciprocal (no money) to a real CPC
-- exchange, without breaking existing reciprocal campaigns.
--
-- budget_cents = 0 (the default, matching every existing campaign) keeps
-- today's behavior exactly: unlimited, free, reciprocal exposure. A campaign
-- only becomes a paid CPC campaign when it's created with budget_cents > 0 —
-- see ads-network-campaigns.mts. This is what lets old and new campaigns
-- coexist in the same auction (ads-network-serve.mts) without a migration
-- step to "convert" anything.
ALTER TABLE ads_network_campaigns
  ADD COLUMN IF NOT EXISTS price_cpc_cents INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS budget_cents    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_cents     INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ads_network_campaigns_price ON ads_network_campaigns (price_cpc_cents DESC);

-- Bug fix, found while wiring the CPC conversion: the self-tenant was seeded
-- with the pre-migration store@jblessd.com address (see
-- 20260823160000_seed_self_tenant_and_network_targeting.sql), but
-- ads-network-autopilot.mts has always looked up store@multinicheai.com.
-- Every autopilot run since the domain migration has hit "self-tenant not
-- seeded" and exited without creating a slot or a single campaign — the
-- network has been sitting empty on this store's side the whole time.
UPDATE ads_tenants
SET email = 'store@multinicheai.com', site_url = 'https://multinicheai.com'
WHERE email = 'store@jblessd.com';
