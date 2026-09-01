-- Seeds benchmark_scenarios for the 5 MultiConnect products. The original
-- 20260826190000_seed_all_benchmark_scenarios.sql only ever ran once, and it
-- ran before MultiConnect existed — so none of AI-CN-001 through AI-CN-005
-- ever got a scenario row, which means scorecard-runner.mts has silently
-- never scored them. This closes that gap.
--
-- Unlike the original migration's one-generic-prompt-per-category approach,
-- each connector gets its own tailored scenario: they're five meaningfully
-- different products (webhook plumbing vs. a Shopify integration vs. an
-- approval-gated email queue), and a shared generic "connectors" prompt
-- would flatten that difference into a worse, less informative benchmark run
-- for every one of them.
--
-- id pattern matches the original migration: lower(sku) || '-v1'.
INSERT INTO benchmark_scenarios (id, sku, prompt, version, active) VALUES
  (
    'ai-cn-001-v1',
    'AI-CN-001',
    'Walk through wiring this bridge up for a realistic case: an agent that needs to fire an outbound event to Zapier when a task completes, and receive an inbound webhook from Zapier to kick off a new task. Show the field mapping you would enter in the dashboard for both directions, and the concrete request/response shape at each step.',
    1,
    true
  ),
  (
    'ai-cn-002-v1',
    'AI-CN-002',
    'Walk through a realistic use of this connector: a new Shopify order comes in, and the agent needs to draft a confirmation email and check whether the ordered item is now low on stock. Show what the connector hands the agent at each step, and what safe-mode setting the store owner would need for this to work end to end.',
    1,
    true
  ),
  (
    'ai-cn-003-v1',
    'AI-CN-003',
    'Walk through a realistic use of this connector: a new lead row appears in a Google Sheet, the agent needs to read it, draft a first-touch email, and then write the updated lead stage back to the same row. Show the field mapping for both directions and what the dashboard setup looks like.',
    1,
    true
  ),
  (
    'ai-cn-004-v1',
    'AI-CN-004',
    'Walk through a realistic use of this connector: the agent drafts a follow-up email to a lead who replied to a cold outreach message. Show exactly what happens between the agent drafting it and the email actually sending — specifically, where the approval queue and safe-mode gate sit in that flow, and what a human sees before anything goes out.',
    1,
    true
  ),
  (
    'ai-cn-005-v1',
    'AI-CN-005',
    'Walk through a realistic use of this connector: a deploy finishes and the agent needs to post an alert to a specific Slack channel and a specific Discord channel at the same time, using one named route. Show the dashboard setup for that route and what safe-mode setting is required for the post to actually go out.',
    1,
    true
  )
ON CONFLICT (id) DO NOTHING;
