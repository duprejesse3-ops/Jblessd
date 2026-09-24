CREATE TABLE IF NOT EXISTS benchmark_scenarios (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  prompt TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES benchmark_scenarios(id),
  sku TEXT NOT NULL,
  output TEXT NOT NULL,
  duration_ms INT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','partial','failed')),
  self_rated_quality INT CHECK (self_rated_quality BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_sku ON benchmark_runs (sku, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_scenarios_sku ON benchmark_scenarios (sku, active);
