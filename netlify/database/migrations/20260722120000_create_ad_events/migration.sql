-- First-party Google Ads attribution dataset.
--
-- The storefront already fires value-based purchase conversions to Google Ads /
-- GA4 from the browser, but that data lives inside Google's account — the owner
-- has no first-party record to slice, and browser events are lost to ad blockers
-- and closed tabs. This table is the store's own copy of what drives revenue:
--
--   * 'landing'  — one row per ad arrival (a URL carrying a gclid/gbraid/wbraid
--                  click id, or utm_* campaign params). Recorded best-effort by
--                  the public /api/track-landing beacon. This is the "clicks"
--                  side that the ad-performance report divides revenue by.
--   * 'purchase' — one row per paid order, written server-side from the Stripe
--                  webhook (survives closed tabs / blocked pixels) carrying the
--                  real order value and the ad click id + campaign captured at
--                  checkout, so each sale ties back to the click that produced it.
--
-- No personally-identifiable data is stored: no email, name, IP, or address —
-- only the ad-attribution signals needed to answer "which campaign / keyword /
-- landing page actually converts", which is what the bid strategy optimises on.
CREATE TABLE IF NOT EXISTS "ad_events" (
	"id" bigserial PRIMARY KEY,
	"event_type" text NOT NULL DEFAULT 'landing',
	"click_id" text,
	"click_source" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"landing_path" text,
	"referrer_host" text,
	"device" text,
	"session_id" text,
	"value" numeric(12, 2),
	"currency" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- The report filters by event_type and windows by recency, so index both.
CREATE INDEX IF NOT EXISTS ad_events_type_created_idx ON ad_events (event_type, created_at DESC);
-- Purchases are attributed to landings by matching the ad click id.
CREATE INDEX IF NOT EXISTS ad_events_click_id_idx ON ad_events (click_id);
-- Campaign-level rollups group on utm_campaign.
CREATE INDEX IF NOT EXISTS ad_events_campaign_idx ON ad_events (utm_campaign);
-- Stripe delivers webhooks at least once and retries on any non-2xx, so guard
-- against double-counting a purchase: at most one purchase row per session id.
CREATE UNIQUE INDEX IF NOT EXISTS ad_events_purchase_session_idx
	ON ad_events (session_id) WHERE event_type = 'purchase';
