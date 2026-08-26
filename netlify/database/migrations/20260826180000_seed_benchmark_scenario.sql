INSERT INTO benchmark_scenarios (id, sku, prompt, version, active)
VALUES (
  'meeting-notes-v1',
  'AI-AG-003',
  'Notes from today''s call: John said pricing needs to go up, maybe 10%. Sarah worried about churn if we do that. Need to decide by Friday. Someone needs to email the design team about the new mockups. Q3 roadmap still not finalized, revisit next week. Action items unclear, follow up needed.',
  1,
  true
)
ON CONFLICT (id) DO NOTHING;
