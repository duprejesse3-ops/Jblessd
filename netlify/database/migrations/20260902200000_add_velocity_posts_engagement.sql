-- Adds engagement-tracking columns to velocity_posts so posted content can be
-- looked up on its origin platform later (for the engagement-scanner boost
-- loop) without having to re-derive an ID/URL after the fact.

ALTER TABLE velocity_posts
  ADD COLUMN IF NOT EXISTS platform_post_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_post_url TEXT,
  ADD COLUMN IF NOT EXISTS engagement_checked_at TIMESTAMPTZ;

-- Used by engagement-scanner.mts to find posted-but-not-yet-scanned rows
-- within its check window without a full table scan.
CREATE INDEX IF NOT EXISTS idx_velocity_posts_engagement_scan
  ON velocity_posts (status, engagement_checked_at, posted_at)
  WHERE status = 'posted';
