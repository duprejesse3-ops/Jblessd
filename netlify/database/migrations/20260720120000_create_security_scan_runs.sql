-- Records each security-bot scan so the current posture and recurring issues
-- survive deploys and can be inspected without relying on transient logs.
CREATE TABLE IF NOT EXISTS "security_scan_runs" (
	"id" bigserial PRIMARY KEY,
	"status" text NOT NULL CHECK (status IN ('secure', 'warning', 'critical')),
	"summary" text NOT NULL,
	"recommendation" text NOT NULL DEFAULT '',
	"checks" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_scan_runs_created_at_idx
	ON security_scan_runs (created_at DESC);
