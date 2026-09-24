-- SWARM organism registry.
--
-- ad_events (see 20260722120000_create_ad_events.sql) already has real
-- landings/purchases/revenue per organism (keyed by utm_campaign/utm_content)
-- the moment a posted organism gets a real visitor. What it never had is the
-- organism itself — headline, body, channel, which SKU — because that copy
-- only ever lived in the store owner's own browser (SWARM's lab state is
-- client-persisted, see swarm/README.md). A stranger loading the public
-- scorecard has no local copy of it.
--
-- This table is that missing half: one row per organism, written once by
-- POST /api/swarm-register the moment SWARM's goLive() actually ships it (see
-- swarm/src/lib/store.ts). It's the same text about to be posted publicly to
-- X/Reddit/Google Ads anyway, so there's nothing here that isn't already
-- public the moment it's written.
--
-- Roll-forward only.
CREATE TABLE IF NOT EXISTS swarm_organisms (
  org_id      TEXT PRIMARY KEY,          -- SWARM's organism id (utm_content)
  swarm_id    TEXT NOT NULL,             -- SWARM's swarm id (utm_campaign)
  sku         TEXT NOT NULL,
  channel     TEXT NOT NULL,             -- 'search' | 'conversation' | 'proof' | 'shadow'
  headline    TEXT NOT NULL,
  body        TEXT NOT NULL,
  proof_hook  TEXT,
  landing_url TEXT NOT NULL,
  live_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swarm_organisms_swarm ON swarm_organisms (swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_organisms_live_at ON swarm_organisms (live_at DESC);
