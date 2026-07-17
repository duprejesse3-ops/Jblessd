-- Records each discovery-crawler run so crawl coverage and recurring discovery
-- gaps survive deploys and can be inspected without relying on transient logs.
-- Mirrors site_health_runs, but this bot walks the site's internal link graph
-- like a search-engine crawler and reconciles it against the sitemap and the
-- live catalog, so "coverage" (which pages are actually discoverable) is the
-- thing being tracked rather than endpoint uptime.
CREATE TABLE IF NOT EXISTS "crawl_runs" (
	"id" bigserial PRIMARY KEY,
	"status" text NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
	"summary" text NOT NULL,
	"recommendation" text NOT NULL DEFAULT '',
	"checks" jsonb NOT NULL,
	"metrics" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crawl_runs_created_at_idx
	ON crawl_runs (created_at DESC);
