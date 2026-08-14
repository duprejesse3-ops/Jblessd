-- Lets MULTINICHE AI's own store participate in its own ad network the same
-- way any other MultiNiche Ads tenant does — as a row in ads_tenants — instead
-- of needing a parallel, single-tenant code path. Two reasons this matters:
--   1. A brand-new network has no other tenants yet, so jblessd.com's own
--      campaigns are what fills empty slots until real tenants join.
--   2. jblessd.com can also offer its own storefront as ad space (a slot),
--      the same way any tenant would.
--
-- The access key below is shown ONLY in this migration's accompanying chat
-- message — like any tenant key, only its hash is ever stored, so it cannot
-- be recovered from the database afterward. Rotate it later via
-- ads-tenants-admin if it's ever exposed.
INSERT INTO ads_tenants (name, email, key_hash, site_url, status)
VALUES (
  'MULTINICHE AI (self)',
  'store@jblessd.com',
  'ec44c724f0751321ab4b42669c33779f13ec989d845786c698f51d5cae8292cd',
  'https://jblessd.com',
  'active'
)
ON CONFLICT (email) DO NOTHING;

-- Lightweight targeting: which "Built For" niche a network campaign is aimed
-- at (nullable — untargeted campaigns are eligible for any slot). Lets the
-- serve endpoint prefer a relevant ad over a random one without needing a
-- per-request AI call in the hot path.
ALTER TABLE ads_network_campaigns ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE ads_network_slots ADD COLUMN IF NOT EXISTS niche TEXT;
