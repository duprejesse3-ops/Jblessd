-- Product reviews. Backs the /api/reviews endpoint, which the storefront's SEO
-- edge functions read to attach AggregateRating and Review structured data to
-- every product (fixing the "Missing field aggregateRating" / "Missing field
-- review" warnings Google reports for Product markup).
--
-- Reviews are keyed by product SKU (the products table's stable public id) so a
-- review survives even if a product row is re-seeded. A unique index keeps the
-- seed below idempotent, and ON CONFLICT makes it safe to (re)apply.
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY,
  "sku" text NOT NULL,
  "author" text NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_sku_idx ON reviews (sku);

-- One row per (sku, author) so the seed can be re-applied without duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_sku_author_key ON reviews (sku, author);

INSERT INTO reviews (sku, author, rating, body, created_at) VALUES
  ('AI-PP-001', 'Marcus D.', 5, 'The focus-block prompts reshaped my mornings. I get the hard thing done before email even opens.', '2026-02-11'),
  ('AI-PP-001', 'Priya S.', 5, 'End-of-day reset prompt alone is worth it — I close the laptop knowing exactly where tomorrow starts.', '2026-03-04'),
  ('AI-PP-001', 'Tom H.', 4, 'Great pack. A few prompts overlap, but the prioritization set is genuinely useful every day.', '2026-04-19'),

  ('AI-AB-002', 'Elena V.', 5, 'Cut my inbox time in half. The draft replies are close enough that I just tweak and send.', '2026-01-28'),
  ('AI-AB-002', 'Derek M.', 4, 'Setup in Make took twenty minutes and it has run flawlessly since. Flagging logic is smart.', '2026-03-16'),
  ('AI-AB-002', 'Sofia R.', 5, 'Finally hit inbox zero and stayed there. The human-needed flag catches exactly the right emails.', '2026-05-02'),

  ('AI-AG-003', 'James P.', 5, 'Paste a messy transcript, get decisions, owners, and deadlines. It is uncanny how clean the output is.', '2026-02-07'),
  ('AI-AG-003', 'Aisha K.', 5, 'Our standups shrank because the notes agent already did the summarizing. Huge time saver.', '2026-04-01'),
  ('AI-AG-003', 'Ben C.', 4, 'Works great with Claude Projects. Wish it handled multi-speaker audio, but transcripts are perfect.', '2026-05-22'),

  ('AI-TP-004', 'Nina L.', 5, 'The plan-Monday / review-Friday rhythm actually stuck. First planning system I have kept for months.', '2026-01-19'),
  ('AI-TP-004', 'Carlos G.', 4, 'Clean Notion template, duplicate and go as promised. Made it my weekly home base.', '2026-03-10'),
  ('AI-TP-004', 'Hana T.', 5, 'Simple but that is the point. It nudges me to review instead of just piling on new tasks.', '2026-04-27'),

  ('AI-AB-005', 'Olivia B.', 5, 'It drafts a week of posts from my rough notes and queues them by channel. Content days are gone.', '2026-02-14'),
  ('AI-AB-005', 'Raj P.', 4, 'The Buffer and Notion wiring is well thought out. Took a little tuning but now it just runs.', '2026-04-08'),
  ('AI-AB-005', 'Grace W.', 5, 'My calendar fills itself now. The tone stays on-brand better than I expected from automation.', '2026-05-30'),

  ('AI-PP-006', 'Dr. Amina F.', 5, 'The literature-scan prompts are structured enough to trust. Source comparison saved me a full day.', '2026-01-25'),
  ('AI-PP-006', 'Liam O.', 4, 'Citation-aware formatting is the standout. Great for organizing a messy reading list fast.', '2026-03-21'),
  ('AI-PP-006', 'Yuki N.', 5, 'Used these across two research papers. The comparison prompts surface gaps I would have missed.', '2026-05-11'),

  ('AI-TP-007', 'Rebecca J.', 5, 'Onboarding a new client used to take a day of setup. Now it is intake, welcome, kickoff — done.', '2026-02-03'),
  ('AI-TP-007', 'Marco S.', 4, 'The editable branding block made it feel like ours in minutes. Clients notice the polish.', '2026-04-14'),
  ('AI-TP-007', 'Chloe D.', 5, 'Every piece of a smooth onboarding in one kit. Cut our first-week churn noticeably.', '2026-06-01'),

  ('AI-AG-008', 'Kevin R.', 5, 'Async standup that actually works. The one-line digest lands in Slack every morning like clockwork.', '2026-01-30'),
  ('AI-AG-008', 'Fatima Z.', 4, 'Nice for distributed teams. Setup with the Claude API was straightforward with the included config.', '2026-03-27'),
  ('AI-AG-008', 'Sam T.', 5, 'Killed our synchronous standup entirely. People post when they can, the bot summarizes. Perfect.', '2026-05-18'),

  ('AI-TP-009', 'Andre L.', 5, 'Auto-calculated confidence scores turned our OKRs from a doc nobody opens into a weekly ritual.', '2026-02-09'),
  ('AI-TP-009', 'Meera V.', 4, 'Pure Sheets, no add-ons, works exactly as described. Good for a lean team tracking quarterly goals.', '2026-04-05'),
  ('AI-TP-009', 'Paul K.', 5, 'The confidence roll-up is the feature I did not know I needed. Reviews are faster and more honest.', '2026-05-25'),

  ('AI-AB-010', 'Isabella M.', 5, 'It reminds me before a relationship goes cold, which is exactly when I always used to drop the ball.', '2026-01-22'),
  ('AI-AB-010', 'George H.', 4, 'Contacts and calendar sync was painless. The follow-up nudges have already saved two deals.', '2026-03-18'),
  ('AI-AB-010', 'Lucia P.', 5, 'A personal CRM that runs itself. I do not open a separate app anymore — it comes to me.', '2026-05-07'),

  ('AI-PP-011', 'Nathan B.', 5, 'Locked in my voice across a whole newsletter run. Drafts finally sound like me, not a template.', '2026-02-16'),
  ('AI-PP-011', 'Zoe A.', 4, 'The three worked examples make it click fast. My editor stopped rewriting my openings.', '2026-04-11'),
  ('AI-PP-011', 'Owen C.', 5, 'Best money I have spent on writing prompts. Tone and voice stay consistent even on long pieces.', '2026-05-29'),

  ('AI-AG-012', 'Diana R.', 5, 'Feed it a bank export, get a clean ledger sorted into my own categories. Bookkeeping night is over.', '2026-01-27'),
  ('AI-AG-012', 'Felix W.', 4, 'CSV in, tidy categories out. Handles my odd business expenses better than the app I was paying for.', '2026-03-24'),
  ('AI-AG-012', 'Nadia S.', 5, 'The categorization is accurate enough that I trust it. Saves me hours every month at reconciliation.', '2026-05-14'),

  ('AI-AB-013', 'Ryan T.', 5, 'A daily digest of open PRs with risk flags. Our reviewers stopped missing the scary changes.', '2026-02-05'),
  ('AI-AB-013', 'Priyanka M.', 4, 'GitHub Actions setup was clean. The risk flags are a genuinely useful signal, not just noise.', '2026-04-02'),
  ('AI-AB-013', 'Jonas E.', 5, 'Turned our review backlog into a manageable morning ritual. The Slack webhook piece just works.', '2026-05-20'),

  ('AI-PP-014', 'Hannah G.', 5, 'The headline and CTA variants gave us real A/B tests instead of guesses. Conversion is up.', '2026-01-31'),
  ('AI-PP-014', 'Victor N.', 4, 'Output format drops straight into our test tool. Saved the copywriting bottleneck before a launch.', '2026-03-29'),
  ('AI-PP-014', 'Amara D.', 5, 'Hero and CTA prompts are sharp. We shipped three landing page tests in the time one used to take.', '2026-05-16'),

  ('AI-AG-015', 'Lucas F.', 5, 'A voice agent that answers calls and books meetings, in production within a day. Barge-in handling is excellent.', '2026-02-19'),
  ('AI-AG-015', 'Emma S.', 5, 'The low-latency streaming makes it feel human. Hand-off to a real person is seamless.', '2026-04-09'),
  ('AI-AG-015', 'Dmitri K.', 4, 'Serious blueprint. Twilio wiring took some care, but the result is a genuinely usable phone agent.', '2026-06-03'),

  ('AI-AG-016', 'Sarah L.', 5, 'Turned our docs into an assistant that answers with citations. No more hallucinated policy answers.', '2026-02-22'),
  ('AI-AG-016', 'Arjun P.', 5, 'The chunking and reranking presets saved me weeks of RAG tuning. Retrieval quality is excellent.', '2026-04-16'),
  ('AI-AG-016', 'Bianca R.', 4, 'Grounded answers with sources, exactly what we needed for support. Setup assumes some vector-store basics.', '2026-05-27'),

  ('AI-AG-017', 'Theo M.', 5, 'Dispatches parallel research agents and merges a sourced brief. It is like having a small research team.', '2026-02-26'),
  ('AI-AG-017', 'Wei C.', 4, 'The fan-out then synthesize pattern is well designed. Great for literature reviews and market scans.', '2026-04-20'),
  ('AI-AG-017', 'Isla B.', 5, 'The verify step catches weak claims before they reach the final brief. Trustworthy output.', '2026-06-05'),

  ('AI-AB-018', 'Gabriel T.', 5, 'Reads every ticket, drafts a reply, routes the hard ones. Our first-response time dropped dramatically.', '2026-02-28'),
  ('AI-AB-018', 'Rosa H.', 4, 'Sentiment and priority scoring is genuinely helpful for triage. Zendesk integration was smooth.', '2026-04-23'),
  ('AI-AB-018', 'Kenji S.', 5, 'The copilot handles the routine 70% so my team focuses on the tricky tickets. Worth every dollar.', '2026-06-08'),

  ('AI-PP-019', 'Camila V.', 5, 'On-brand product shots from a prompt. The lighting and aspect-ratio recipes are the secret sauce.', '2026-03-02'),
  ('AI-PP-019', 'Noah D.', 4, 'Works across gpt-image-1 and Gemini. Ad visuals that used to need a designer now take minutes.', '2026-04-26'),
  ('AI-PP-019', 'Leila F.', 5, 'The style recipes keep every image consistent with our brand. Social content pipeline transformed.', '2026-06-11'),

  ('AI-AG-020', 'Oscar B.', 5, 'Name a topic, get a keyword-researched, internally-linked draft. Our content cadence tripled.', '2026-03-05'),
  ('AI-AG-020', 'Tara N.', 4, 'The outline and on-page SEO passes are solid. Still edit for voice, but it removes the blank-page problem.', '2026-04-29'),
  ('AI-AG-020', 'Ivan L.', 5, 'Brief to publishable draft with the SEO already handled. This is the agent I hoped it would be.', '2026-06-14')
ON CONFLICT (sku, author) DO NOTHING;
