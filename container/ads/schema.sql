-- MultiAds: self-advertising content tables
-- Run through the same migration pipeline as the rest of container/ (container_schema_migrations)

CREATE TABLE IF NOT EXISTS seo_pages (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,        -- e.g. 'guides/developers/automations'
  niche         TEXT NOT NULL,
  category      TEXT NOT NULL,
  title         TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  product_skus  TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'published'
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seo_pages_niche_category ON seo_pages (niche, category);
CREATE INDEX IF NOT EXISTS idx_seo_pages_status ON seo_pages (status);

-- Tracks which generated page a visit/sale came from, for simple attribution
-- without needing a full ad-platform integration.
CREATE TABLE IF NOT EXISTS content_conversions (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL REFERENCES seo_pages(slug),
  session_id    TEXT,
  sku           TEXT,
  event_type    TEXT NOT NULL,   -- 'view' | 'free_pack_claim' | 'order'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_conversions_slug ON content_conversions (slug);
