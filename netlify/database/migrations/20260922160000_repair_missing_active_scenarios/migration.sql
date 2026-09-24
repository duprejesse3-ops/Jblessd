-- Repairs SKUs left with zero active benchmark_scenarios rows by the
-- non-atomic deactivate+insert in scenario-generator.mts (fixed in the same
-- change as this migration). Any product whose only active scenario got
-- deactivated but never got its replacement inserted has had a dead
-- /scorecard/:sku page ever since — this restores a scorecard for it using
-- the same per-category generic templates the original catalog seed used.
--
-- scenario-generator.mts's weekly run will find these generic templates
-- and rewrite them into product-specific prompts on its own, same as any
-- other still-generic scenario — no separate follow-up needed.
--
-- Idempotent: a product that already has an active scenario is untouched
-- (the NOT EXISTS guard), so this is safe to re-run.

INSERT INTO benchmark_scenarios (id, sku, prompt, version, active)
SELECT
  lower(p.sku) || '-repair-v1',
  p.sku,
  CASE p.category
    WHEN 'prompts' THEN 'Run the primary prompt in this pack on a realistic, specific task for its target audience, and show the finished output.'
    WHEN 'automations' THEN 'Walk through a single realistic run of this automation: the trigger, each step, and the concrete end result.'
    WHEN 'templates' THEN 'Fill this template in with a realistic, fully worked example so the result is production-ready.'
    WHEN 'agents' THEN 'Handle one representative task end to end in character, from an incoming request to a finished response.'
    ELSE 'Demonstrate this product on a realistic task for its target audience.'
  END,
  1,
  true
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM benchmark_scenarios s WHERE s.sku = p.sku AND s.active = true
)
ON CONFLICT (id) DO NOTHING;
