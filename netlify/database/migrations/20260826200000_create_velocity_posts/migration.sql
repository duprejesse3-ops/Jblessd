CREATE TABLE IF NOT EXISTS velocity_posts (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,      -- 'proof' | 'scorecard' | 'product'
  source_id TEXT NOT NULL,        -- proof id / sku
  platform TEXT NOT NULL,         -- 'x' | 'youtube_shorts' | 'reddit'
  content TEXT NOT NULL,          -- the actual post/script text
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','posted','failed')),
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_velocity_posts_status ON velocity_posts (status, scheduled_for);
