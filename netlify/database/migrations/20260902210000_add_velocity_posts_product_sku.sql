-- Adds product_sku to velocity_posts. source_id already holds the sku for
-- scorecard-sourced posts, but for proof-sourced posts source_id is the
-- proof's own id, not the product sku — the poster functions need the sku
-- directly (to fetch a matching creative from /api/ad-image) without having
-- to re-look-up the proof row at post time.

ALTER TABLE velocity_posts
  ADD COLUMN IF NOT EXISTS product_sku TEXT;
