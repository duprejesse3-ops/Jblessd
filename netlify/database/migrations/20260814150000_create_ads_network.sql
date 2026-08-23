-- MultiNiche Ads network — base schema. The endpoint files
-- (ads-network-slots.mts, ads-network-campaigns.mts, ads-network-serve.mts,
-- ads-network-click.mts) and the seed migration
-- (20260814200000_seed_self_tenant_and_network_targeting.sql) already assume
-- these tables exist; this migration is what actually creates them.
--
-- A "tenant" is any site participating in the network — jblessd.com itself
-- included, as a normal row (see the seed migration right after this one).
-- A tenant offers ad space (a "slot") and/or runs its own ad into other
-- tenants' slots (a "campaign"). No money changes hands: reciprocal exposure
-- only, tracked first-party via ads_network_events.

CREATE TABLE IF NOT EXISTS ads_tenants (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  key_hash    TEXT NOT NULL,           -- sha256 of the tenant's mnads_... key; the key itself is never stored
  site_url    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'suspended'
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_tenants_key_hash ON ads_tenants (key_hash);

CREATE TABLE IF NOT EXISTS ads_network_slots (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES ads_tenants(id),
  slot_key    TEXT UNIQUE NOT NULL,
  site_url    TEXT NOT NULL,
  label       TEXT,
  niche       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'paused'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_network_slots_tenant ON ads_network_slots (tenant_id);

CREATE TABLE IF NOT EXISTS ads_network_campaigns (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES ads_tenants(id),
  headline        TEXT NOT NULL,
  body            TEXT NOT NULL,
  image_url       TEXT,
  click_url       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'paused'
  impression_cap  INTEGER NOT NULL DEFAULT 0,       -- 0 = unlimited
  click_cap       INTEGER NOT NULL DEFAULT 0,       -- 0 = unlimited
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_network_campaigns_tenant ON ads_network_campaigns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ads_network_campaigns_status ON ads_network_campaigns (status);

CREATE TABLE IF NOT EXISTS ads_network_events (
  id            SERIAL PRIMARY KEY,
  slot_id       INTEGER NOT NULL REFERENCES ads_network_slots(id),
  campaign_id   INTEGER NOT NULL REFERENCES ads_network_campaigns(id),
  type          TEXT NOT NULL,   -- 'impression' | 'click'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_network_events_campaign ON ads_network_events (campaign_id);
