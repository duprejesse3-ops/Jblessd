-- Records each security-agent run so the site's security posture and any
-- recurring gaps survive deploys and can be inspected without relying on
-- transient logs. Mirrors site_health_runs / crawl_runs, but this bot inspects
-- the live HTTP response headers (HSTS, CSP, framing, MIME sniffing, referrer
-- and permissions policy, and stack-leak headers) so "hardening" — how well the
-- responses defend the browser — is the thing being tracked rather than uptime
-- or discoverability.
CREATE TABLE IF NOT EXISTS "security_runs" (
	"id" bigserial PRIMARY KEY,
	"status" text NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
	"summary" text NOT NULL,
	"recommendation" text NOT NULL DEFAULT '',
	"checks" jsonb NOT NULL,
	"metrics" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_runs_created_at_idx
	ON security_runs (created_at DESC);
