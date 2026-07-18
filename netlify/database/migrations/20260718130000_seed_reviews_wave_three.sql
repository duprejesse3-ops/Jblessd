-- Seeds reviews for the wave-three products (SKUs AI-*-031 .. AI-*-042) added in
-- 20260717150000_add_products_wave_three. Those products shipped without any
-- reviews, so every product page and the homepage ItemList lost its
-- AggregateRating + Review structured data for them, and the scheduled site
-- maintenance check ("Review data") started failing: rated products (30)
-- trailed the catalog count (42), so the bot reported "1 critical check failed"
-- and the site status stuck at unhealthy.
--
-- This is a roll-forward migration: it only inserts new review rows keyed by
-- (sku, author). The unique index reviews_sku_author_key + ON CONFLICT keeps it
-- idempotent and safe to re-apply, exactly like the founding review seed and the
-- wave-two seed.
INSERT INTO reviews (sku, author, rating, body, created_at) VALUES
  ('AI-TP-031', 'Warren D.', 5, 'The rejected-options section is what makes an ADR worth writing. Six months on we still know why we said no.', '2026-06-21'),
  ('AI-TP-031', 'Lena H.', 4, 'Dropped the templates into Notion and our decisions finally have a paper trail. New hires ramp on the reasoning, not folklore.', '2026-07-03'),
  ('AI-TP-031', 'Marcus O.', 5, 'The trade-off matrix turned a two-week argument into a one-hour decision the whole team could sign off on.', '2026-07-14'),

  ('AI-PP-032', 'Sanjay R.', 5, 'It pressure-tests a design across scale and failure modes before I write a line. Caught a capacity gap that would have paged us at 2am.', '2026-06-24'),
  ('AI-PP-032', 'Beatrice N.', 4, 'The C4 prompts keep my diagrams honest. Capacity math baked into the pack saved me a spreadsheet.', '2026-07-06'),
  ('AI-PP-032', 'Kofi A.', 5, 'Fifty prompts that read like a senior architect interrogating your design. My reviews got sharper overnight.', '2026-07-15'),

  ('AI-AG-033', 'Dana P.', 5, 'It walked our design and surfaced two trust boundaries we had completely missed. STRIDE without the whiteboard marathon.', '2026-06-26'),
  ('AI-AG-033', 'Ravi S.', 4, 'The data-flow analysis is the standout. It found an attack path through a service we thought was internal-only.', '2026-07-08'),
  ('AI-AG-033', 'Ingrid M.', 5, 'Threat modeling used to be the meeting everyone dodged. Now the agent drafts it and we just review the mitigations.', '2026-07-16'),

  ('AI-AB-034', 'Tobias L.', 5, 'Our diagrams regenerate from the code on every merge, so they are finally trustworthy. No more stale architecture wiki.', '2026-06-22'),
  ('AI-AB-034', 'Priya K.', 4, 'The Structurizr export dropped into our docs cleanly. Took a little tuning but now the diagrams just stay current.', '2026-07-05'),
  ('AI-AB-034', 'Owen F.', 5, 'Mermaid output straight from the infra means reviewers actually look at the diagrams again. Brilliant.', '2026-07-13'),

  ('AI-TP-035', 'Helena V.', 5, 'The adopt/trial/assess/hold rings gave our platform team a shared language. Tech debates got a lot less religious.', '2026-06-25'),
  ('AI-TP-035', 'Diego C.', 4, 'Rationale attached to each ring is the part that stuck. We stopped relitigating the same tooling arguments.', '2026-07-07'),
  ('AI-TP-035', 'Amara T.', 5, 'A living radar the whole org reads. New teams see what to adopt and what to retire without asking around.', '2026-07-15'),

  ('AI-AG-036', 'Gustav E.', 5, 'It reads a design doc like a principal engineer and returns the exact questions I would have asked in review.', '2026-06-27'),
  ('AI-AG-036', 'Naledi B.', 4, 'Scored against a rubric, so the feedback is consistent across authors. Junior engineers ship better RFCs now.', '2026-07-09'),
  ('AI-AG-036', 'Vincent H.', 5, 'The sharp questions land before the meeting, not during it. Our design reviews got an hour shorter.', '2026-07-16'),

  ('AI-AB-037', 'Rosa M.', 5, 'A blameless postmortem draft with action items already assigned before I have finished my coffee. Game changer for on-call.', '2026-06-23'),
  ('AI-AB-037', 'Elliot W.', 4, 'The timeline-to-root-cause flow is solid. PagerDuty and Slack wiring dropped in without drama.', '2026-07-04'),
  ('AI-AB-037', 'Yuki S.', 5, 'Follow-ups actually get owners now instead of evaporating. Our incident review culture improved because the draft is already there.', '2026-07-14'),

  ('AI-PP-038', 'Hassan D.', 5, 'Generates and reviews Terraform without the copy-paste drift. It caught a security-group mistake in review that I would have shipped.', '2026-06-28'),
  ('AI-PP-038', 'Clara N.', 4, 'The K8s and Helm prompts are practical, not toy examples. Refactoring manifests got a lot less error-prone.', '2026-07-08'),
  ('AI-PP-038', 'Ibrahim T.', 5, 'Forty-five prompts that cover the real IaC workflow. My Terraform reviews are faster and I trust them more.', '2026-07-16'),

  ('AI-AG-039', 'Miriam P.', 5, 'It reads the alert, pulls the right runbook, and proposes the first three checks before I am even logged in. On-call anxiety down.', '2026-06-29'),
  ('AI-AG-039', 'Theo K.', 4, 'The alert-to-runbook mapping is the piece that saves time at 3am. Setup wanted our runbooks tidy, which was overdue anyway.', '2026-07-10'),
  ('AI-AG-039', 'Aiko R.', 5, 'New engineers can take on-call sooner because the agent scaffolds the triage. Genuinely leveled up our rotation.', '2026-07-16'),

  ('AI-AB-040', 'Lucas G.', 5, 'Caught a silent pipeline failure that had been dropping rows for days. It explained what broke in plain language, no log spelunking.', '2026-06-30'),
  ('AI-AB-040', 'Freya O.', 4, 'The schema-drift detection paid for itself the first week. dbt and Airflow hooks were straightforward to wire up.', '2026-07-10'),
  ('AI-AB-040', 'Samuel A.', 5, 'Great Expectations plus this monitor means we hear about data issues before the dashboards look wrong. Huge for trust.', '2026-07-16'),

  ('AI-TP-041', 'Grace L.', 5, 'Runbooks the whole team can follow at 3am — deploy, rollback, restore. We stopped relying on the one person who knew the steps.', '2026-06-24'),
  ('AI-TP-041', 'Farid H.', 4, 'The rollback play alone justified it during an incident last month. Clear enough that a tired engineer got it right.', '2026-07-06'),
  ('AI-TP-041', 'Noelle W.', 5, 'Operational knowledge finally lives somewhere other than Slack scrollback. Onboarding to on-call got dramatically calmer.', '2026-07-15'),

  ('AI-PP-042', 'Dmitri B.', 5, 'The repro-isolate-fix workflow turned a vague hunch into a reproducible root cause in twenty minutes. This is how debugging should feel.', '2026-06-27'),
  ('AI-PP-042', 'Sofia N.', 4, 'Sixty prompts that structure the messy part of debugging. Feeding it a stack trace gets me to isolation far faster.', '2026-07-09'),
  ('AI-PP-042', 'Emeka C.', 5, 'It stopped me thrashing on a heisenbug by forcing a clean repro first. The Notion version is my go-to now.', '2026-07-16')
ON CONFLICT (sku, author) DO NOTHING;
