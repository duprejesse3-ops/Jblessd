INSERT INTO benchmark_scenarios (id, sku, prompt, version, active)
SELECT
  lower(sku) || '-v1',
  sku,
  CASE category
    WHEN 'prompts' THEN 'Run the primary prompt in this pack on a realistic, specific task for its target audience, and show the finished output.'
    WHEN 'automations' THEN 'Walk through a single realistic run of this automation: the trigger, each step, and the concrete end result.'
    WHEN 'templates' THEN 'Fill this template in with a realistic, fully worked example so the result is production-ready.'
    WHEN 'agents' THEN 'Handle one representative task end to end in character, from an incoming request to a finished response.'
    ELSE 'Demonstrate this product on a realistic task for its target audience.'
  END,
  1,
  true
FROM products
ON CONFLICT (id) DO NOTHING;
