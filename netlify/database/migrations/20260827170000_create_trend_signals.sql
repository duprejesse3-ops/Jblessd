CREATE TABLE IF NOT EXISTS trend_signals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  term TEXT NOT NULL,
  matched_sku TEXT,
  strength INT NOT NULL DEFAULT 1,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trend_signals_sku ON trend_signals (matched_sku, detected_at DESC);

CREATE TABLE IF NOT EXISTS featured_products (
  sku TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
