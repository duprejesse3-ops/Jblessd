-- Domain migration follow-up: jblessd.com -> multinicheai.com.
--
-- The self-tenant row seeded in 20260823160000_seed_self_tenant_and_network_
-- targeting.sql was created back when the store's own domain was still
-- jblessd.com. That migration has already run against the live database, so
-- its file is left with the original jblessd.com values (editing an applied
-- migration's content changes its checksum and breaks the migration runner
-- for every deploy afterward, which is what happened here). This migration
-- updates the row in place instead.
UPDATE ads_tenants
SET
  email = 'store@multinicheai.com',
  site_url = 'https://multinicheai.com'
WHERE email = 'store@jblessd.com';
