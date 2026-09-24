-- Seeds reviews for the wave-two products (SKUs AI-*-021 .. AI-*-030) added in
-- 20260717120000_add_products_wave_two. Those products shipped without any
-- reviews, so every product page and the homepage ItemList lost its
-- AggregateRating + Review structured data for them, and the scheduled site
-- maintenance check ("Review data") started failing because rated products
-- (20) trailed the catalog count (30).
--
-- This is a roll-forward migration: it only inserts new review rows keyed by
-- (sku, author). The unique index reviews_sku_author_key + ON CONFLICT keeps it
-- idempotent and safe to re-apply, exactly like the founding review seed.
INSERT INTO reviews (sku, author, rating, body, created_at) VALUES
  ('AI-PP-021', 'Devon R.', 5, 'The failure taxonomy is the part I keep coming back to. I can name why a prompt drifted and fix it in minutes.', '2026-06-20'),
  ('AI-PP-021', 'Simone A.', 4, 'Before/after templates made the difference. My Claude prompts stopped quietly ignoring the constraints I set.', '2026-07-02'),
  ('AI-PP-021', 'Wesley K.', 5, 'Finally a systematic way to debug prompts instead of guessing. The hallucination checklist alone paid for it.', '2026-07-11'),

  ('AI-AG-022', 'Renata M.', 5, 'It handles the pricing back-and-forth better than half my team. The hand-off timing to a human is spot on.', '2026-06-24'),
  ('AI-AG-022', 'Colin B.', 4, 'The guardrails kept it from over-promising on discounts. Tone controls made it sound like us, not a bot.', '2026-07-05'),
  ('AI-AG-022', 'Priya D.', 5, 'Scheduling negotiations used to eat my mornings. Now it settles the routine ones and only escalates the tricky asks.', '2026-07-13'),

  ('AI-TP-023', 'Nolan F.', 5, 'A rough idea becomes a spec my coding agent can actually follow. The agent-readable structure is the whole point.', '2026-06-27'),
  ('AI-TP-023', 'Harriet L.', 4, 'Copy-paste ready as promised. My team and Claude both work off the same doc now, which cut a lot of confusion.', '2026-07-06'),
  ('AI-TP-023', 'Sean O.', 5, 'Turned a napkin sketch into a build-ready spec in an afternoon. The prompts for filling each section are gold.', '2026-07-14'),

  ('AI-AB-024', 'Bianca T.', 5, 'Call notes, next steps, and the deal stage land in HubSpot before I leave the meeting. I stopped doing CRM admin.', '2026-06-22'),
  ('AI-AB-024', 'Marcus V.', 4, 'The Salesforce mapping took a little tuning, but once set it runs itself. Next-step detection is genuinely good.', '2026-07-03'),
  ('AI-AB-024', 'Ines G.', 5, 'Every call now ends with the CRM already updated. The Notion sync is a nice bonus for our internal handoffs.', '2026-07-12'),

  ('AI-PP-025', 'Tariq H.', 5, 'The hook formulas are tuned per platform and it shows. My Reels open rate jumped the first week I used them.', '2026-06-25'),
  ('AI-PP-025', 'Elodie C.', 4, 'Sixty starting points beats a blank page every time. The X presets in particular match how that feed reads.', '2026-07-07'),
  ('AI-PP-025', 'Jamal W.', 5, 'Scroll-stopping is not an exaggeration. The LinkedIn hooks got me my best-performing post of the quarter.', '2026-07-15'),

  ('AI-AG-026', 'Freya N.', 5, 'A standing agent that briefs me weekly with real sources. It reads like a research assistant, not a summarizer.', '2026-06-28'),
  ('AI-AG-026', 'Adrian P.', 4, 'The citation checks are what make it trustworthy. Scheduled runs mean I never have to remember to kick it off.', '2026-07-08'),
  ('AI-AG-026', 'Mei L.', 5, 'I track three topics for my thesis and it keeps each thread current. The sources hold up when I follow them.', '2026-07-16'),

  ('AI-TP-027', 'Gregory S.', 5, 'Our monthly update went from a dreaded chore to fifteen minutes. Investors reply now because the ask is unmissable.', '2026-06-23'),
  ('AI-TP-027', 'Yasmin R.', 4, 'The metrics block keeps me honest month to month. Clean layout that makes even a flat month read as steady.', '2026-07-04'),
  ('AI-TP-027', 'Louis B.', 5, 'Keeps investors warm between rounds. The clear-ask section has directly gotten us two intros this quarter.', '2026-07-13'),

  ('AI-AB-028', 'Karin E.', 5, 'Merged PRs become readable release notes automatically. Our changelog is finally something customers actually read.', '2026-06-26'),
  ('AI-AB-028', 'Tobias M.', 4, 'The GitHub Action dropped in cleanly and the Linear tie-in is handy. Notes need light edits but the draft is 90% there.', '2026-07-09'),
  ('AI-AB-028', 'Sophia D.', 5, 'It posts a customer-ready changelog to Slack on every release. We stopped writing release notes by hand entirely.', '2026-07-15'),

  ('AI-PP-029', 'Rafael O.', 5, 'Interviewed myself with the prompts and got a style guide I now hand to every model. Drafts finally sound like me.', '2026-06-29'),
  ('AI-PP-029', 'Delphine A.', 4, 'Captured our brand voice into one reusable system prompt. Onboarding freelance writers got dramatically faster.', '2026-07-10'),
  ('AI-PP-029', 'Victor H.', 5, 'The interview-to-styleguide flow is clever. I cloned a client''s tone in an hour and their team could not tell.', '2026-07-16'),

  ('AI-AG-030', 'Naomi C.', 5, 'It flagged two accounts as at-risk a full week before they would have churned. We saved both with the outreach plays.', '2026-06-30'),
  ('AI-AG-030', 'Emeka F.', 4, 'Signal scoring blends usage and support tickets sensibly. The save-plays gave my CS team a script that actually works.', '2026-07-10'),
  ('AI-AG-030', 'Clara W.', 5, 'A churn early-warning system without a data team. It watches the signals so I can focus on the accounts that matter.', '2026-07-16')
ON CONFLICT (sku, author) DO NOTHING;
