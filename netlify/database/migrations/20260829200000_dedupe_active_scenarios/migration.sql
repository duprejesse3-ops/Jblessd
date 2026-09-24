-- One-time cleanup: some SKUs currently have MORE THAN ONE active benchmark
-- scenario row, from overlapping scenario-generator runs earlier today
-- racing each other (each one's UPDATE-then-INSERT wasn't atomic, so two
-- concurrent runs could both insert a new active row for the same sku
-- without ever seeing each other's write). This keeps only the newest
-- active row per sku and deactivates the rest.
--
-- Safe to run more than once — it's idempotent.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY sku ORDER BY created_at DESC) AS rn
  FROM benchmark_scenarios
  WHERE active = true
)
UPDATE benchmark_scenarios
SET active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevents this from ever happening again: the database itself now refuses
-- a second active row for the same sku, so a race between two overlapping
-- generator runs fails loudly (a constraint violation one of them has to
-- handle) instead of silently leaving duplicate active scenarios.
CREATE UNIQUE INDEX IF NOT EXISTS uq_benchmark_scenarios_one_active_per_sku
  ON benchmark_scenarios (sku)
  WHERE active = true;
