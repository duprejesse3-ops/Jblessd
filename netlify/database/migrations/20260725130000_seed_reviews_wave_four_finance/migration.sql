-- Seeds reviews for the wave-four and finance products (SKUs AI-*-043 through
-- AI-*-064). These products were added after the previous review seed, leaving
-- 22 catalog items without aggregate ratings and causing the scheduled site
-- maintenance "Review data" check to fail.
--
-- This roll-forward migration only inserts review rows. The existing unique
-- index on (sku, author) and ON CONFLICT clause keep it idempotent.
INSERT INTO reviews (sku, author, rating, body, created_at) VALUES
  ('AI-PP-043', 'Maya R.', 5, 'The active-recall prompts turned six weeks of lecture material into a study plan I could actually follow.', '2026-06-18'),
  ('AI-PP-043', 'Ethan C.', 4, 'Spaced repetition is built into the workflow instead of being an afterthought. My review sessions are much more focused.', '2026-07-03'),
  ('AI-PP-043', 'Lena T.', 5, 'I used it for two finals and stopped wasting time rereading everything. The practice-question prompts are excellent.', '2026-07-17'),

  ('AI-TP-044', 'Jordan P.', 5, 'The Cornell layout finally made my notes useful after class instead of just a transcript I never reopened.', '2026-06-20'),
  ('AI-TP-044', 'Nia S.', 4, 'Clean, simple, and easy to duplicate for every course. The cue columns make weekly review much faster.', '2026-07-05'),
  ('AI-TP-044', 'Caleb M.', 5, 'One workspace for lectures, summaries, and exam review solved the scattered-notes problem for me.', '2026-07-19'),

  ('AI-AG-045', 'Avery K.', 5, 'It pointed out where my argument jumped ahead without rewriting the paper for me. The rubric scoring felt fair and specific.', '2026-06-22'),
  ('AI-AG-045', 'Sofia B.', 4, 'The line-level clarity notes are especially useful. I still make every decision, but revision takes half the time.', '2026-07-07'),
  ('AI-AG-045', 'Miles D.', 5, 'This feels like office-hours feedback on demand. It caught a weak thesis and three unsupported claims before submission.', '2026-07-21'),

  ('AI-PP-046', 'Priya N.', 5, 'A long biology lecture became a clean Anki deck in minutes. The prompts separate definitions from application questions well.', '2026-06-19'),
  ('AI-PP-046', 'Owen H.', 4, 'The CSV output imported without cleanup. I only had to trim a few cards that covered material outside the exam.', '2026-07-04'),
  ('AI-PP-046', 'Camila V.', 5, 'It makes better cards than my old copy-and-paste method because each answer stays short enough to recall.', '2026-07-18'),

  ('AI-TP-047', 'Noah J.', 5, 'Seeing every deadline and the projected grade in one place made the semester feel manageable from week one.', '2026-06-24'),
  ('AI-TP-047', 'Amara L.', 4, 'The Notion dashboard is polished and the Sheets GPA calculator works without extra setup.', '2026-07-08'),
  ('AI-TP-047', 'Lucas F.', 5, 'I stopped discovering assignments the night before they were due. The weekly workload view is the standout.', '2026-07-22'),

  ('AI-AB-048', 'Zoe W.', 5, 'Dropping in a DOI and getting a correctly formatted citation in Zotero saves a surprising amount of time.', '2026-06-21'),
  ('AI-AB-048', 'Henry A.', 4, 'APA and Chicago output matched the guides I checked. The Make scenario was straightforward to connect.', '2026-07-06'),
  ('AI-AB-048', 'Iris G.', 5, 'My bibliography stays current while I research instead of becoming a cleanup project at the end.', '2026-07-20'),

  ('AI-AG-049', 'Mateo E.', 5, 'The Socratic style keeps me working through the problem instead of handing me an answer I forget five minutes later.', '2026-06-23'),
  ('AI-AG-049', 'Chloe Y.', 4, 'Subject presets gave it the right level for calculus and chemistry. It asks useful follow-up questions.', '2026-07-09'),
  ('AI-AG-049', 'Samira Q.', 5, 'It found the exact misconception behind my wrong answers and walked me back to the principle I had missed.', '2026-07-23'),

  ('AI-PP-050', 'Danielle R.', 5, 'The decline and follow-up prompts help me be direct without sounding cold. I use them almost every day.', '2026-06-25'),
  ('AI-PP-050', 'Victor M.', 4, 'Tone controls are practical and the outputs need very little editing. The status-update set is especially strong.', '2026-07-10'),
  ('AI-PP-050', 'Leah C.', 5, 'Difficult workplace emails no longer sit in drafts for an hour. The prompts get me to a clear first version quickly.', '2026-07-24'),

  ('AI-TP-051', 'Andre S.', 5, 'Decisions, owners, and due dates stay attached to the meeting instead of disappearing into separate notes.', '2026-06-26'),
  ('AI-TP-051', 'Mei P.', 4, 'The agenda is lean enough that people actually use it. Converting discussion into action items is effortless.', '2026-07-11'),
  ('AI-TP-051', 'Tara B.', 5, 'Our weekly meetings end with a clean record and no confusion about who owns the next step.', '2026-07-24'),

  ('AI-AB-052', 'Colin J.', 5, 'A folder of phone photos became a categorized expense report with the line items already captured.', '2026-06-27'),
  ('AI-AB-052', 'Fatima D.', 4, 'The OCR handled most receipts perfectly and the few exceptions were easy to review in Sheets.', '2026-07-12'),
  ('AI-AB-052', 'Benita O.', 5, 'Month-end expenses went from an afternoon of typing to a quick approval pass.', '2026-07-24'),

  ('AI-AG-053', 'Marcus L.', 5, 'It handles the scheduling loop, respects focus blocks, and sends the calendar invite without me hovering over it.', '2026-06-28'),
  ('AI-AG-053', 'Elena K.', 4, 'Google Calendar setup was smooth. The timezone checks prevented two mistakes in the first week alone.', '2026-07-13'),
  ('AI-AG-053', 'Ravi T.', 5, 'Clients get a fast answer and I no longer spend the day relaying available times back and forth.', '2026-07-24'),

  ('AI-TP-054', 'Nicole F.', 5, 'The prompts pulled the unwritten steps out of our team and turned them into an onboarding guide people can follow.', '2026-06-29'),
  ('AI-TP-054', 'George N.', 4, 'Good balance of detail and readability. The ownership and exception sections keep each SOP operational.', '2026-07-14'),
  ('AI-TP-054', 'Imani W.', 5, 'We documented our five most fragile processes in a week and new hires now need far fewer hand-holding calls.', '2026-07-24'),

  ('AI-AG-055', 'Derek P.', 5, 'The drift report gives me an exact rebalance plan while still showing the tax impact before I act.', '2026-06-30'),
  ('AI-AG-055', 'Alina M.', 4, 'Allocation bands are easy to tune and the output explains why each trade is suggested.', '2026-07-15'),
  ('AI-AG-055', 'Thomas R.', 5, 'It turned a messy multi-account portfolio into one clear set of next actions without losing the lot-level detail.', '2026-07-24'),

  ('AI-AG-056', 'Rachel D.', 5, 'A ninety-minute call became a concise thesis update with guidance changes and the KPIs that actually mattered.', '2026-07-01'),
  ('AI-AG-056', 'Khalil S.', 4, 'Sentiment and management-language comparisons are useful. I still verify the transcript, but the first pass is much faster.', '2026-07-16'),
  ('AI-AG-056', 'Monica H.', 5, 'The bull and bear takeaways make it easy to see what changed from the prior quarter instead of rereading every page.', '2026-07-24'),

  ('AI-AG-057', 'Jasmine C.', 5, 'The monthly review found three recurring expenses I had stopped noticing and converted them into a concrete savings plan.', '2026-07-02'),
  ('AI-AG-057', 'Peter V.', 4, 'Cashflow categories needed a little personalization, but the goal tracking keeps the advice grounded in my numbers.', '2026-07-17'),
  ('AI-AG-057', 'Alicia B.', 5, 'It gives me three realistic actions instead of a generic budget lecture. That makes the review easy to keep doing.', '2026-07-24'),

  ('AI-AG-058', 'Warren L.', 5, 'The sensitivity table makes the valuation assumptions visible, so I can challenge the model instead of trusting one number.', '2026-07-03'),
  ('AI-AG-058', 'Neha G.', 4, 'Bull, base, and bear cases are well structured. The WACC presets are a helpful starting point, not a black box.', '2026-07-18'),
  ('AI-AG-058', 'Felix T.', 5, 'I rebuilt an existing valuation with it and reached the same range in a fraction of the time.', '2026-07-24'),

  ('AI-AB-059', 'Sandra E.', 5, 'Receipt photos land in the ledger with vendor, amount, and tax category already filled in.', '2026-07-04'),
  ('AI-AB-059', 'Omar J.', 4, 'The category mapping is accurate and easy to override. It removed almost all of my weekly bookkeeping entry.', '2026-07-19'),
  ('AI-AB-059', 'Grace P.', 5, 'My accountant gets a cleaner ledger and I no longer have a month-end pile of uncategorized receipts.', '2026-07-24'),

  ('AI-AB-060', 'Nathan K.', 5, 'The thirteen-week view caught a cash gap early enough to move two invoice follow-ups forward.', '2026-07-05'),
  ('AI-AB-060', 'Bianca R.', 4, 'Connecting invoices and bills took some setup, but the rolling forecast is now part of our Monday review.', '2026-07-20'),
  ('AI-AB-060', 'Eric M.', 5, 'It separates expected and committed cash clearly, which makes the forecast much more useful than our old spreadsheet.', '2026-07-24'),

  ('AI-PP-061', 'Harper N.', 5, 'The three-statement prompts keep the model internally consistent and explain the checks instead of just producing formulas.', '2026-07-06'),
  ('AI-PP-061', 'Adrian C.', 4, 'Scenario prompts are the strongest part. They make assumptions explicit and translate cleanly into Sheets.', '2026-07-21'),
  ('AI-PP-061', 'Mina Z.', 5, 'I went from a blank workbook to a usable operating model without skipping the balance-sheet logic.', '2026-07-24'),

  ('AI-PP-062', 'Trevor B.', 5, 'The 10-K workflow pulled the thesis, catalysts, and risk factors into one repeatable research process.', '2026-07-07'),
  ('AI-PP-062', 'Yara A.', 4, 'The prompts force citations back to the filing and make it harder to gloss over a weak assumption.', '2026-07-22'),
  ('AI-PP-062', 'Daniel F.', 5, 'My first-pass research notes are more complete and much easier to compare across companies now.', '2026-07-24'),

  ('AI-TP-063', 'Kelly S.', 5, 'Revenue, burn, runway, and cap table finally live in one investor-ready model instead of four disconnected sheets.', '2026-07-08'),
  ('AI-TP-063', 'Hamid R.', 4, 'The structure matches the questions investors ask. It was simple to replace the examples with our actual numbers.', '2026-07-23'),
  ('AI-TP-063', 'Julia M.', 5, 'Preparing our monthly update now takes minutes because every core metric rolls forward in the same place.', '2026-07-24'),

  ('AI-TP-064', 'Vanessa T.', 5, 'Seeing spending, debt, savings, and net worth together made our monthly money check-in much more productive.', '2026-07-09'),
  ('AI-TP-064', 'Isaac W.', 4, 'The 50/30/20 view is useful without forcing every household into the same plan. Account updates are quick.', '2026-07-23'),
  ('AI-TP-064', 'Renee L.', 5, 'It replaced three separate trackers and gives me one reliable net-worth line to follow over time.', '2026-07-24')
ON CONFLICT (sku, author) DO NOTHING;
