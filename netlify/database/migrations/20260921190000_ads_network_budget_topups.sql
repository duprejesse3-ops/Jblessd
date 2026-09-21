-- Real money changing hands for ads_network_campaigns.budget_cents, via
-- Stripe. This table exists purely for idempotency: Stripe retries webhooks,
-- and a retry must never credit a campaign's budget twice. The unique
-- constraint on stripe_session_id is what makes "have we already applied
-- this session?" a single INSERT ... ON CONFLICT DO NOTHING instead of a
-- read-then-write race.
--
-- See netlify/functions/ads-network-fund.mts (creates the Checkout session)
-- and netlify/functions/webhook.mts (kind === 'ads_network_topup', credits
-- the campaign only if the INSERT here actually landed a new row).
CREATE TABLE IF NOT EXISTS ads_network_budget_topups (
  id                SERIAL PRIMARY KEY,
  stripe_session_id TEXT NOT NULL UNIQUE,
  campaign_id       INTEGER NOT NULL REFERENCES ads_network_campaigns(id),
  tenant_id         INTEGER NOT NULL REFERENCES ads_tenants(id),
  amount_cents      INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_network_topups_campaign ON ads_network_budget_topups (campaign_id);
