-- Records each maintenance-agent run so current health and recurring failures
-- survive deploys and can be inspected without relying on transient logs.
CREATE TABLE IF NOT EXISTS "site_health_runs" (
	"id" bigserial PRIMARY KEY,
	"status" text NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
	"summary" text NOT NULL,
	"recommendation" text NOT NULL DEFAULT '',
	"checks" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_health_runs_created_at_idx
	ON site_health_runs (created_at DESC);
