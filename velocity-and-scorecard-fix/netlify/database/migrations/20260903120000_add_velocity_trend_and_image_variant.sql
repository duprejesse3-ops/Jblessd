-- Adds trend-awareness and image-variety tracking to velocity_posts.
--
-- used_trend_term: the trend_signals.term that shaped this post's content,
-- if any (NULL for posts generated purely from proof/scorecard data — most
-- runs, since forcing a trend tie-in when none genuinely fits would hurt
-- more than posting without one).
--
-- image_variant: which ad-image.mts visual layout was used (0/1/2), so the
-- next run can look at recent history and deliberately avoid repeating the
-- same look back-to-back.

ALTER TABLE velocity_posts
  ADD COLUMN IF NOT EXISTS used_trend_term TEXT,
  ADD COLUMN IF NOT EXISTS image_variant INT NOT NULL DEFAULT 0;

-- Used by velocity-engine.mts to look up the last couple of image variants
-- used, to avoid picking the same one twice in a row.
CREATE INDEX IF NOT EXISTS idx_velocity_posts_recent_variant
  ON velocity_posts (created_at DESC)
  INCLUDE (image_variant);
