// Pre-written "Live Proof" demo text, served with zero live model calls.
//
// demo.mts previously called Claude on every single default (no-scenario)
// demo view until the first visitor per SKU warmed the Blobs cache. That's
// fine at low traffic, but it means every product's FIRST view of the day/
// deploy always pays for a real inference call through Netlify AI Gateway —
// and at real traffic volume, across dozens of products, that adds up fast
// and is billed on Netlify's terms, not the store owner's.
//
// This module is the fix: hand-written demo text for the default view of
// each SKU, checked BEFORE the Blobs cache and BEFORE any live model call.
// A SKU listed here costs nothing to preview, ever, no matter how much
// traffic it gets. A SKU not yet listed here falls through to the existing
// behavior (Blobs cache, then a live call) unchanged — so partial coverage
// never breaks anything, it just means "not free yet" for that one SKU.
//
// Custom-scenario demos (a shopper's own submitted task) always stay live —
// they can't be pre-written by definition. This library only covers the
// generic, no-scenario preview, which is the one that scales with raw
// traffic rather than with genuine buyer interest.
//
// Add to this over time: same PLAYBOOK framing demo.mts uses (a real prompt
// + result / an execution trace / a filled example / an in-character
// response / a live sync), 70–150 words, plain text, no markdown.

export interface DemoLibraryEntry {
  verb: string
  text: string
}

export const DEMO_LIBRARY: Record<string, DemoLibraryEntry> = {
  // ---- MultiConnect ----
  'AI-CN-001': {
    verb: 'Running a live sync through this connector',
    text:
      'Inbound trigger received from Zapier: a new row was added to a Google Sheet — {name: "Dana Okafor", plan: "Pro", email: "dana@northfieldco.com"}.\n\n' +
      'Bridge maps the payload using your saved rules:\n' +
      '  name → customer.full_name\n' +
      '  email → customer.email\n' +
      '  plan → subscription.tier\n\n' +
      'Mapped result forwarded to your agent inbox in 41ms. Agent picks it up, creates the customer record, and fires a welcome email — no code written, no JSON hand-edited. The dashboard test console shows this exact call, timestamped, right after it happens.',
  },
  'AI-CN-002': {
    verb: 'Running a live sync through this connector',
    text:
      'Shopify webhook received: order #4821 placed — 2× "Weighted Blanket, Grey" (SKU WB-GRY-Q), $164.00.\n\n' +
      'Connector checks inventory: 6 units remain after this order, below your 10-unit alert threshold.\n\n' +
      'Two things happen automatically: your agent gets a structured order event to draft the confirmation email, and a low-stock alert fires to whatever channel you\'ve wired it to. Safe-mode is set to read-only here, so nothing was changed in Shopify itself — just observed and relayed. Flip it to read/write and the agent could also push a reorder draft.',
  },
  'AI-CN-003': {
    verb: 'Running a live sync through this connector',
    text:
      'Inbound: a new lead row appeared in your "Leads" Google Sheet — {company: "Northwind Traders", contact: "R. Alvarez", stage: "new"}.\n\n' +
      'Two-way sync picks it up within seconds, maps it into your agent\'s lead format, and the agent drafts a first-touch email. When the agent updates the lead\'s stage to "contacted", that write goes straight back into the same sheet row — no export, no CSV round-trip, no second tool to check. One row in Sheets, one source of truth, both directions live.',
  },
  'AI-CN-004': {
    verb: 'Running a live sync through this connector',
    text:
      'New email arrives: "Hi — following up on the Q3 proposal, can we push the call to Thursday?"\n\n' +
      'Bridge classifies it as a live lead reply, pulls the thread context, and drafts a response confirming Thursday at 2pm with a calendar link — then holds it in the approval queue instead of sending blind.\n\n' +
      'You see the draft, the original message, and one button: approve or edit. Nothing goes out from your inbox without a human okay, and every send is rate-limited so a bad loop can\'t blast your list.',
  },
  'AI-CN-005': {
    verb: 'Running a live sync through this connector',
    text:
      'Agent event fires: nightly backup job completed — 1.2GB, 0 errors, 14m runtime.\n\n' +
      'Routed straight to your #ops-alerts Slack channel:\n' +
      '  ✅ Nightly backup complete — 1.2GB, 14m, 0 errors\n\n' +
      'A failed run would route to a different channel with an @here instead of sitting quietly in a log nobody checks. Type /status in Slack and the bot replies with the last three job results, pulled live from the same event stream — no dashboard tab required.',
  },

  // ---- prompts ----
  'AI-PP-001': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "I have 3 hours today and a launch deck due Friday. Build me a focus block plan that protects deep work and still leaves room for the two meetings I can\'t skip."\n\n' +
      'Result:\n' +
      '9:00–10:30 — Deck: outline + slide 1–4 (phone in another room)\n' +
      '10:30–11:00 — Meeting: standup\n' +
      '11:00–12:30 — Deck: slide 5–9, no Slack\n' +
      '12:30–1:00 — Meeting: launch sync\n' +
      '1:00–1:15 — End-of-day reset: what shipped, what\'s tomorrow\'s first move\n\n' +
      'Two 90-minute blocks, meetings boxed in between instead of splitting the day.',
  },
  'AI-PP-011': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Here\'s a paragraph from my last newsletter: [sample]. Match this exact voice for a new section about a product delay."\n\n' +
      'Result: "Straight talk — the API redesign is taking longer than we said. Not because it\'s broken, because we found a cleaner way halfway through and it was worth the detour. New date: the 14th. If that changes again you\'ll hear it from us before you notice, not after."\n\n' +
      'Same short sentences, same directness, same one self-aware aside — the pack extracted the pattern from your sample and reused it, not a generic "corporate update" tone.',
  },
  'AI-PP-014': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Landing page for a $29/mo invoicing tool for freelancers. Headline + subhead + CTA, tuned for a skeptical, price-sensitive visitor."\n\n' +
      'Result:\n' +
      'Headline: "Invoices that get paid faster, not just invoices."\n' +
      'Subhead: "Automatic reminders, one-click payment links, zero spreadsheets. Free for your first 5 invoices."\n' +
      'CTA: "Send your first invoice free →"\n\n' +
      'Three more headline variants ship in the pack for A/B testing, each pulling a different lever: speed, simplicity, and risk-reversal.',
  },
  'AI-PP-021': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "This prompt worked great for a week, now it randomly ignores my formatting instructions. Here\'s the prompt and three recent bad outputs."\n\n' +
      'Result: Diagnosis — the instruction is buried after 400 words of context, and the model is deprioritizing it under load. Two fixes: (1) move the formatting rule to its own line at the very end, right before the output starts, (2) add one worked example showing the exact format. Both changes included, ready to paste back in. Root cause named, not just a patched prompt.',
  },
  'AI-PP-032': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "We\'re about to commit to a single-region Postgres primary for a service expecting 50k daily users. Pressure-test this before we build it."\n\n' +
      'Result: Three failure modes surfaced — no automatic failover on region outage (single point of failure), connection pool exhaustion above ~2k concurrent writers without pgbouncer, and no plan for read-replica lag under reporting load. Each comes with the concrete fix and roughly what it costs to add now versus retrofit later.',
  },

  // ---- automations ----
  'AI-AB-002': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: new email from "billing@vendorco.com", subject "Invoice #8842 overdue."\n\n' +
      'Filter: matches billing keyword pattern — continues.\n' +
      'Enrich: pulls vendor contact history — 3rd invoice from this sender this quarter.\n' +
      'Decide: category = "Urgent — Finance", confidence 0.94.\n' +
      'Act: drafts a reply confirming receipt and a payment date, flags the invoice thread in your finance label.\n' +
      'Escalate: not needed — confidence is high and the case matches a known pattern.\n\n' +
      'A genuinely ambiguous email instead routes straight to your "needs a human" folder with a one-line reason attached.',
  },
  'AI-AB-005': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: new note added — "3 tips for slashing customer churn — draft for next week."\n\n' +
      'The automation expands it into a 5-post sequence: a hook post, a data-backed claim, a short case example, a contrarian take, and a recap-with-CTA — each sized for its platform (short punchy line for X, fuller context for LinkedIn).\n\n' +
      'All five queue into your calendar spaced two days apart automatically, landing in draft state so you review before anything goes live.',
  },
  'AI-AB-018': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: new ticket — "My export has been stuck at 60% for 2 hours, this is the third time this month."\n\n' +
      'Filter: matches "stuck/stalled" pattern plus repeat-issue keyword — continues.\n' +
      'Enrich: pulls this customer\'s last 2 tickets — same export issue, unresolved both times.\n' +
      'Decide: category = "Recurring bug, frustrated customer", confidence 0.88, needs_human = true.\n' +
      'Act: drafts an apology + status-check reply, but routes to a human agent instead of auto-sending given the repeat pattern and visible frustration.',
  },
  'AI-AB-037': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: incident resolved — checkout latency spiked to 8s for 22 minutes, root cause traced to a connection pool exhaustion after a deploy.\n\n' +
      'Automation drafts:\n' +
      'Summary: Checkout latency degraded for 22 min following the 2:14pm deploy.\n' +
      'Root cause: DB connection pool sized for old traffic pattern, new deploy added 3x concurrent queries per request.\n' +
      'Action items: [ ] Right-size pool for new query pattern — Owner: TBD — Due: this week. [ ] Add pool-utilization alert at 80%.\n\n' +
      'Blameless, timestamped, action items pre-assigned to "TBD" for you to fill in, not skipped.',
  },
  'AI-AB-052': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: 4 receipts dropped into the watched folder — a $34.20 Uber ride, a $12.99 SaaS charge, a $210 client dinner, a $8.50 parking receipt.\n\n' +
      'Automation OCRs each one, categorizes (Travel, Software, Meals & Entertainment, Travel), flags the client dinner for a "who attended" note since it\'s over the $100 auto-approve threshold, and assembles a submission-ready report with all four line items and receipt images attached — ready to submit, one flagged item to confirm.',
  },

  // ---- templates ----
  'AI-TP-004': {
    verb: 'Filling this template with a real example',
    text:
      'Monday plan:\n' +
      'Top 3 this week: Ship pricing page redesign · Close out Q3 vendor contracts · Draft Q4 roadmap draft v1\n' +
      'Deep work blocks: Tue/Thu 9–11am reserved, no meetings\n' +
      'Watching: vendor renewal deadline is Friday — needs a decision by Wednesday\n\n' +
      'Friday review:\n' +
      'Shipped: pricing page (live), vendor contracts (2 of 3 closed)\n' +
      'Carried over: roadmap draft — pushed to Monday, blocked on finance numbers\n' +
      'One thing to fix next week: protect Thursday\'s block better, got pulled into 2 unplanned meetings',
  },
  'AI-TP-009': {
    verb: 'Filling this template with a real example',
    text:
      'Objective: Reduce customer onboarding time from signup to first value.\n' +
      'Key Result 1: Cut median time-to-first-export from 4.2 days to 2 days — Confidence: 60%\n' +
      'Key Result 2: Lift onboarding email open rate from 31% to 45% — Confidence: 80%\n' +
      'Key Result 3: Ship in-app checklist to 100% of new signups — Confidence: 95%\n\n' +
      'Confidence auto-calculates from check-in history — KR3 is nearly done and low-risk, KR1 depends on a redesign that hasn\'t started, so its number is honestly lower, not padded to look good on a dashboard.',
  },
  'AI-TP-027': {
    verb: 'Filling this template with a real example',
    text:
      'Subject: October update — runway extended, two new logos\n\n' +
      'Headline metrics: MRR $84k (+11% MoM) · Burn $61k/mo · Runway 14 months\n' +
      'Wins: Closed Northwind and Alta Retail (combined $6.2k MRR) · Shipped the API v2 customers had been asking for\n' +
      'Challenges: Churned one $2k/mo account over a missing SSO feature — now in progress, ships next month\n' +
      'The ask: Warm intro to anyone running mid-market retail ops — that\'s where our best signal is coming from\n\n' +
      'Numbers first, one honest miss included, one specific ask — not a highlight reel.',
  },
  'AI-TP-041': {
    verb: 'Filling this template with a real example',
    text:
      'Runbook: Production deploy rollback\n\n' +
      'When to use: error rate exceeds 2% within 5 minutes of a deploy, or a P1 alert fires post-deploy.\n' +
      '1. Confirm the spike started at deploy time, not an unrelated cause — check the deploy timestamp against the error graph.\n' +
      '2. Run `deploy rollback --to previous` — takes ~90 seconds.\n' +
      '3. Confirm error rate returns to baseline within 3 minutes.\n' +
      '4. Post in #incidents with the rollback confirmation and open a ticket for root cause.\n\n' +
      'Written so the on-call engineer at 3am can follow it without needing tribal knowledge.',
  },

  // ---- agents ----
  'AI-AG-003': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Input: raw 40-minute call transcript, product roadmap discussion.\n\n' +
      'Agent output:\n' +
      'Decisions: Ship the API v2 change before the mobile redesign, not after (reversing last week\'s call).\n' +
      'Owners: Priya — finalize API v2 spec by Friday. Marcus — scope mobile redesign for Q1, not this quarter.\n' +
      'Open questions: Still unresolved whether pricing changes ship with API v2 or separately — flagged for next sync.\n\n' +
      'Pulled from 40 minutes of cross-talk and tangents down to what actually needs to happen next.',
  },
  'AI-AG-030': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Signal check on account "Alta Retail" (Pro plan, $340/mo):\n' +
      'Logins: 2 in last 30 days, down from 18/month average\n' +
      'Support: 1 ticket, unresolved for 6 days — "how do we export to our new POS system"\n' +
      'Seat usage: 2 of 5 seats active, down from 5 of 5\n\n' +
      'Flagged: high churn risk, driven by an unresolved integration blocker, not dissatisfaction with the core product. Suggested play: proactive outreach from support with a direct answer to the export question, not a generic check-in — the risk is specific and fixable.',
  },
  'AI-AG-039': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Alert: "checkout-api p99 latency > 3000ms for 5min"\n\n' +
      'Agent reads the runbook for this alert and proposes:\n' +
      '1. Check active DB connections vs pool size — likely exhaustion after a traffic spike\n' +
      '2. Check for a recent deploy in the last 30 minutes — correlate timestamps\n' +
      '3. Check downstream payment provider status page — rule out an external dependency\n\n' +
      'Three checks, ordered by likelihood, before you\'ve even finished reading the page — not a generic "investigate the issue" nudge.',
  },
  'AI-AG-045': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Draft submitted: 800-word argumentative essay on remote work productivity.\n\n' +
      'Feedback: Your thesis in paragraph 1 claims remote work "always" improves output, but paragraph 3 cites a study showing mixed results for collaborative tasks — that\'s a real tension, not a contradiction to hide. Either narrow the thesis to "for individual, focus-heavy work" or address the collaborative-task counterevidence directly. Structure is otherwise strong: each paragraph does earn its place.\n\n' +
      'Points to the exact gap, doesn\'t write the fix for you.',
  },
  'AI-AG-055': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Current allocation: 72% equities, 8% bonds, 20% cash. Target: 65/25/10.\n\n' +
      'Analysis: Equities are 7 points over target — likely drift from recent gains, not a deliberate bet. Bonds are 17 points under target, meaningfully increasing portfolio volatility versus your stated risk tolerance.\n\n' +
      'Suggested trades: Sell ~$8,400 in equities (largest overweight position first, to minimize tax lots disturbed), buy ~$12,000 in the bond allocation, hold cash steady. Tax-lot aware — flags which specific lots to sell for the smallest gain realized.',
  },

  // ---- other ----
  'AI-AG-065': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Site Audit Agent (Source Code) is real, downloadable software you run on your own infrastructure — not something we can honestly demo running against a site we don\'t operate.\n\n' +
      'What it actually does: sixteen checks (broken links, missing alt text, stale sitemap entries, slow pages, and more), run on a schedule you control via cron, GitHub Actions, systemd, or a serverless function — your choice, no subscription either way.\n\n' +
      'Buy it, unzip it, run `./install.sh`, and `site-audit yoursite.com` is a real command on your machine in under a minute.',
  },

  // ---- prompts (remaining) ----
  'AI-PP-006': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "I have 14 papers on urban heat islands. Compare their methodologies and flag where they disagree."\n\n' +
      'Result: A table — 9 papers use satellite thermal imaging, 5 use ground sensors, and the two methods disagree by 2–4°C in dense urban cores. Three papers (Chen 2023, Osei 2022, Bakr 2024) attribute this gap to sensor placement height; two others don\'t address it at all — flagged as a methodology gap worth noting in your lit review, not glossed over.',
  },
  'AI-PP-019': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Product shot for a matte ceramic mug, terracotta color, on a warm neutral background, soft directional light, for an Instagram ad."\n\n' +
      'Result: Full generation spec — 45° camera angle, single soft key light from upper-left at 30% intensity, warm beige backdrop (#E8DDD0), shallow depth of field with the mug handle in sharp focus. Includes the exact prompt string ready to paste into gpt-image-1 or Gemini, plus two lighting variants (morning-warm, studio-neutral) for A/B testing.',
  },
  'AI-PP-025': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Hook for a Reel about a $9 kitchen tool that replaced 4 gadgets."\n\n' +
      'Result: "I returned 4 kitchen gadgets after buying this $9 thing." (pattern-interrupt + specific number)\n' +
      'X variant: "Sold my $200 gadget drawer for this $9 tool. No regrets."\n' +
      'LinkedIn variant: "I audited my kitchen spend. One $9 tool replaced $200 of gadgets I used twice."\n\n' +
      'Same core claim, three different rhythms — each tuned to how that platform\'s feed actually gets scrolled.',
  },
  'AI-PP-029': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Input: 3 paragraphs of past interview answers from a founder.\n\n' +
      'Result — extracted style guide: Short declarative sentences, avg 12 words. Uses concrete numbers over adjectives ("grew 40%" not "grew a lot"). One self-deprecating aside per ~200 words. Never uses "leverage," "synergy," or other startup-speak. Ends answers with a forward-looking line, not a summary.\n\n' +
      'That guide becomes a reusable system prompt — paste it into any model and get the founder\'s actual voice, not a generic "professional" tone.',
  },
  'AI-PP-038': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Here\'s our Terraform for an EKS cluster. Review for drift risk and cost before we apply."\n\n' +
      'Result: Flagged — node group uses `desired_capacity` without a corresponding autoscaling policy, so it\'ll silently drift from actual load. Also: no `lifecycle { prevent_destroy }` on the RDS instance, meaning a `terraform destroy` could take production data with it. Estimated monthly cost: $340, mostly from 2 oversized m5.xlarge nodes that a t3.large pair would handle at current utilization.',
  },
  'AI-PP-042': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "NullPointerException in OrderProcessor.java line 84, only happens in production, never locally. Stack trace attached."\n\n' +
      'Result: Line 84 dereferences `customer.getAddress()` — the null is almost certainly a guest checkout, since guest orders have no saved address and your local test data always includes one. Repro: create a test order with `customer.address = null`. Fix: null-check before dereference, with a fallback to the shipping form address instead of the profile.',
  },
  'AI-PP-043': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Organic chemistry midterm in 9 days, weakest on reaction mechanisms."\n\n' +
      'Result: Day 1–2: active-recall drills on the 8 mechanism types (SN1, SN2, E1, E2, and 4 more), 15 min each, no notes. Day 3: mixed practice set, mechanisms only. Day 4: rest — spaced repetition works better with a gap. Day 5–7: full practice exams, timed, mechanisms weighted 2x. Day 8: review only the mechanisms you missed twice. Day 9: light review, sleep early.',
  },
  'AI-PP-046': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Input: 20-minute lecture transcript on cellular respiration.\n\n' +
      'Result — 6 sample cards:\n' +
      'Q: What are the 3 stages of cellular respiration? A: Glycolysis, Krebs cycle, electron transport chain.\n' +
      'Q: Where does glycolysis occur? A: Cytoplasm.\n' +
      'Q: Net ATP yield from glycolysis? A: 2 ATP.\n\n' +
      'Full set runs 30+ cards, exported as a ready-to-import Anki deck — no manual reformatting.',
  },
  'AI-PP-050': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Decline a vendor\'s price increase request without damaging the relationship — we want to keep working with them."\n\n' +
      'Result: "Thanks for the transparency on rising costs — I know that\'s not an easy conversation to start. For this contract term, we need to hold at current pricing; it\'s a hard constraint on our end this year. I\'d like to revisit this at renewal with more lead time, and I\'m glad to talk through where else we might create value together in the meantime."\n\n' +
      'Firm on the number, warm on the relationship — no vague hedging.',
  },
  'AI-PP-061': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Build a 3-statement model for a SaaS company: $50k MRR, 8% monthly growth, 70% gross margin, $30k monthly burn."\n\n' +
      'Result: Month 1 revenue $50k, Month 12 revenue ~$126k (compounding at 8%). Gross profit scales with revenue at 70%. Burn held flat shows runway extending as revenue closes the gap — breakeven projected around month 9. Full formula set provided for Sheets/Excel, with the compounding growth formula shown explicitly so you can adjust the 8% assumption yourself.',
  },
  'AI-PP-062': {
    verb: 'Running a representative prompt from this pack',
    text:
      'Prompt: "Here\'s [Company]\'s latest 10-K. Build an investment thesis."\n\n' +
      'Result: Catalyst — new product line launching Q2 could add 3-4 points of revenue growth, underappreciated by current guidance. Risk — customer concentration: top 3 customers are 41% of revenue, up from 33% last year, a real dependency risk not flagged in the MD&A discussion. Price target framework: applies a 2-point premium to peer multiple given the growth catalyst, discounted 1 point for concentration risk.',
  },

  // ---- automations (remaining) ----
  'AI-AB-010': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: contact "James Whitfield" (last touched 34 days ago, no note since) crosses your 30-day follow-up threshold.\n\n' +
      'Filter: relationship marked "active" not "dormant" — continues.\n' +
      'Enrich: pulls last interaction — a warm intro call about a potential partnership, no follow-up scheduled.\n' +
      'Act: adds a reminder to your task list with the last conversation\'s context attached, so you\'re not starting cold.\n\n' +
      'A contact marked "dormant" instead gets silently skipped — no reminder noise for relationships you\'ve already let go.',
  },
  'AI-AB-013': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: daily digest run, 9am.\n\n' +
      'Open PRs found: 6. Digest:\n' +
      '  #412 "Add rate limiting" — 3 days open, no reviews, risk: touches auth middleware\n' +
      '  #418 "Fix typo in README" — 1hr open, trivial, safe to merge\n' +
      '  #409 "Refactor payment retry logic" — 5 days open, 2 approvals, risk: no test coverage added\n\n' +
      'Posted to Slack sorted by risk, not by age — the 5-day-old refactor with missing tests surfaces above the newer, riskier auth PR.',
  },
  'AI-AB-024': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: call ends — 22-minute discovery call with a prospect, transcript available.\n\n' +
      'Automation extracts: Contact — Sarah Kim, VP Ops at Fenwick Logistics. Next step — send pricing by Thursday. Deal stage — moves from "Discovery" to "Proposal Sent" once pricing goes out.\n\n' +
      'Pushed into your CRM before you\'ve even closed the call window: the note, the next step with a due date, and the stage change — nothing typed in manually after the fact.',
  },
  'AI-AB-028': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: 8 PRs merged since last release — feature additions, 2 bug fixes, 1 breaking change to the auth API.\n\n' +
      'Generated release notes:\n' +
      '  🎉 New: Bulk export for reports, dark mode toggle\n' +
      '  🐛 Fixed: Timezone bug in scheduled reports, memory leak in the dashboard\n' +
      '  ⚠️ Breaking: API tokens now require a scope parameter — see migration guide\n\n' +
      'Internal changelog and the customer-facing version generated together, in the tone each audience needs.',
  },
  'AI-AB-034': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: merge to main — new Redis cache layer added between the API and the database.\n\n' +
      'Automation detects the new service in the infra code, regenerates the architecture diagram, and opens a PR with just the diagram change: a new "Cache" node appears between "API Gateway" and "Postgres," with the connection direction inferred from the actual code.\n\n' +
      'Diagram PR merges alongside the infra PR — no one has to remember to update a diagram by hand three weeks later.',
  },
  'AI-AB-040': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: nightly pipeline run — "customer_events" table completed with 0 rows, expected ~40,000.\n\n' +
      'Automation catches the anomaly (a silent failure, not an error — the job "succeeded" with no data), checks upstream: the source API changed its auth token format 6 hours ago.\n\n' +
      'Explains it in plain language in your alert: "customer_events loaded 0 rows — likely cause: upstream auth failure starting ~6h ago, not a code issue on our end" — not a cryptic stack trace.',
  },
  'AI-AB-048': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: pasted a DOI — 10.1038/s41586-021-03819-2.\n\n' +
      'Automation fetches the metadata and formats it three ways:\n' +
      'APA: Author, A. (2021). Title of paper. Nature, 592, 123-127.\n' +
      'MLA: Author, First. "Title of Paper." Nature, vol. 592, 2021, pp. 123-127.\n' +
      'Chicago: Author, First. "Title of Paper." Nature 592 (2021): 123-127.\n\n' +
      'Added to your Zotero library automatically, correctly formatted, no manual retyping of author names or page numbers.',
  },
  'AI-AB-059': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: photo of a crumpled gas station receipt dropped into the watched folder, $42.18.\n\n' +
      'OCR extracts: vendor "Shell", amount $42.18, date 08/29. Category: Vehicle/Fuel — matched against your defined tax categories.\n\n' +
      'Ledger entry created: Date 08/29 | Vendor Shell | Amount $42.18 | Category Vehicle: Fuel | Deductible: Yes (business mileage log shows this trip). Ready for your accountant at year-end, no manual re-typing from a fading receipt.',
  },
  'AI-AB-060': {
    verb: 'Simulating one run of this automation',
    text:
      'Trigger: weekly forecast refresh.\n\n' +
      'Pulls 6 open invoices ($34,200 expected in) and 4 upcoming bills ($28,900 due) across the next 13 weeks.\n\n' +
      'Forecast flags week 7: a $19,000 vendor payment lands the same week as two client invoices are only "likely," not confirmed — projected cash dips to $4,100, tightest point in the forecast. Flagged 6 weeks ahead of time, not discovered the week it happens.',
  },

  // ---- agents (remaining) ----
  'AI-AG-008': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Collected async updates from #standup:\n' +
      '  Priya: "Finished the auth refactor, starting on rate limiting today"\n' +
      '  Marcus: "Blocked on the design review, pinged Sarah"\n' +
      '  Dev: "Shipped the mobile fix, no blockers"\n\n' +
      'Posted digest: "3 updates — auth refactor done ✅, rate limiting starts today. Marcus blocked on design review (pinged Sarah, following up if no response by noon). Mobile fix shipped, no blockers." One line, one flag on the thing that actually needs attention.',
  },
  'AI-AG-012': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Input: bank CSV export, 84 transactions for August.\n\n' +
      'Output: sorted into your defined categories — Software $412 (6 charges), Travel $891 (3 charges), Payroll $12,400, Office Supplies $67, Uncategorized: 2 charges flagged for your review ("SQ *UNKNOWN VENDOR $34.00" and a duplicate-looking $200 charge).\n\n' +
      'Clean ledger for 82 of 84 transactions, with the genuinely ambiguous ones flagged instead of silently guessed at.',
  },
  'AI-AG-015': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Incoming call: "Hi, I\'d like to book a consultation for next Tuesday afternoon if possible."\n\n' +
      'Agent: "I can help with that — I have 1pm or 3:30pm open next Tuesday. Which works better?"\n' +
      'Caller: "3:30 works."\n' +
      'Agent: "You\'re booked for Tuesday at 3:30pm, confirmation text is on its way. Anything else I can help with?"\n\n' +
      'Low-latency streaming means no awkward pause before each response — barge-in handling means the caller can interrupt mid-sentence and the agent adjusts instead of talking over them.',
  },
  'AI-AG-016': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Question: "What\'s our policy on refunds for annual plans?"\n\n' +
      'Answer: "Annual plans are refundable within 30 days of purchase, prorated after that based on unused months. [Source: Billing Policy §4.2, updated March 2026]"\n\n' +
      'The citation isn\'t decorative — click through and it opens the exact doc section the answer came from. Ask something not covered in your docs and it says so plainly instead of guessing, which is the entire point of grounding it in retrieval rather than a generic model\'s training data.',
  },
  'AI-AG-017': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Task: "Research the current state of solid-state EV battery commercialization."\n\n' +
      'Fan-out: 4 sub-agents dispatched in parallel — one on manufacturing timelines, one on major players (Toyota, QuantumScape, Samsung SDI), one on cost-per-kWh trends, one on regulatory hurdles.\n\n' +
      'Synthesize: merged into one brief with each claim tagged to its source agent\'s findings. Verify: a fifth pass cross-checks the manufacturing-timeline and cost-trend agents, which had partially conflicting numbers — flags the discrepancy rather than silently picking one.',
  },
  'AI-AG-020': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Topic given: "best project management tools for remote teams."\n\n' +
      'Agent researches current search intent, drafts a 1,400-word article structured around the actual questions people search (not a generic listicle), and internally links to two related articles already on your site.\n\n' +
      'Output includes the draft, a meta description, and a note: "Search intent here skews comparison-heavy — added a comparison table, which competing top-10 results are missing." Strategic reasoning included, not just word count.',
  },
  'AI-AG-022': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Prospect: "Can you do $8k instead of $10k? We\'re tight on budget this quarter."\n\n' +
      'Agent: "I can get you to $9,200 if we move to annual billing instead of monthly — that\'s the best I\'m able to do without approval above my guardrails. Want me to draft that up, or would you like to loop in your rep directly?"\n\n' +
      'Stays within its configured discount ceiling, offers a real alternative instead of just declining, and hands off the moment the ask exceeds what it\'s allowed to negotiate — not a moment later.',
  },
  'AI-AG-026': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Standing topic: "developments in mRNA vaccine platforms."\n\n' +
      'This week\'s brief: 3 new developments found. A phase 2 trial result (source: published journal, linked), a manufacturing partnership announcement (source: company press release, linked), and one preprint claim about efficacy that hasn\'t been peer-reviewed — flagged explicitly as "unverified preprint, treat cautiously" rather than presented with equal weight to the peer-reviewed result.',
  },
  'AI-AG-033': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Design: a customer-facing API that accepts file uploads, stores them in S3, and processes them async via a queue.\n\n' +
      'Findings: Trust boundary crossed at upload — no file-type validation shown in the design, opening a path for malicious file uploads (STRIDE: Tampering). Queue has no dead-letter handling — a malformed message could loop indefinitely (STRIDE: Denial of Service). S3 bucket policy not specified — flagged as the single highest-risk gap until confirmed private.',
  },
  'AI-AG-036': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Design doc: proposal to migrate from a monolith to 6 microservices over one quarter.\n\n' +
      'Questions raised: "The doc says services will communicate via REST, but section 3 also mentions an event bus for order updates — which is authoritative, and why both?" "No rollback plan is mentioned if service 3 of 6 fails mid-migration — what\'s the fallback?" "Data ownership for the shared \'customer\' entity isn\'t assigned to any single service — who owns writes?"\n\n' +
      'Scored 6/10 on the review rubric: strong on service boundaries, weak on migration risk and data ownership.',
  },
  'AI-AG-049': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Student: "Why does ice float on water?"\n\n' +
      'Tutor: "Good question — before I answer, what do you know about how molecules are arranged in a solid versus a liquid?"\n' +
      'Student: "Solids are... more packed together?"\n' +
      'Tutor: "Usually true! But water\'s a weird exception. What do you think might happen to water\'s density if it broke that usual pattern when freezing?"\n\n' +
      'Never hands over the answer — narrows the gap with the next question until the student reaches it themselves.',
  },
  'AI-AG-053': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Request: "Find 30 minutes with Dana sometime this week for a project check-in."\n\n' +
      'Agent checks both calendars, finds 3 overlapping open slots, proposes Wednesday 2pm (avoiding Dana\'s recurring focus block on Thursdays, which it also noticed and respected without being told).\n\n' +
      'Sends the invite with a title pulled from the request ("Project check-in"), confirms back: "Booked Wednesday 2-2:30pm with Dana, invite sent." No back-and-forth email thread required.',
  },
  'AI-AG-056': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Input: raw Q3 earnings call transcript.\n\n' +
      'Output — Guidance: raised full-year revenue guidance by 2%, cited "stronger enterprise demand." Sentiment: cautiously optimistic on enterprise, notably guarded on consumer segment (3 hedged statements vs. 0 last quarter). Key numbers: gross margin expanded 140bps to 62.3%, the number that actually moved the stock after-hours — not the headline revenue beat, which was already priced in.',
  },
  'AI-AG-057': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Monthly review: $6,200 spent, savings goal is $1,000/month, actual saved: $310.\n\n' +
      'Leaks found: $180/month across 4 unused subscriptions (2 forgotten trials that converted to paid). $240 in weekday food delivery, up 60% from last month\'s average. One $340 "one-time" purchase that\'s recurred 3 months running.\n\n' +
      'Three moves: cancel the 2 dormant subscriptions ($180/mo back), cap delivery at 2x/week, review whether the recurring "one-time" purchase should just be budgeted as a real line item.',
  },
  'AI-AG-058': {
    verb: 'Putting this agent to work on a real task',
    text:
      'Inputs: $2.1B revenue, 18% growth, 24% FCF margin, 9% WACC.\n\n' +
      'Bull case ($64/share): growth holds at 18% through year 3 before decelerating.\n' +
      'Base case ($51/share): growth decelerates to 12% by year 3, in line with sector average.\n' +
      'Bear case ($38/share): margin compression from new competition, growth falls to 8%.\n\n' +
      'Full sensitivity table included showing how the valuation moves across a WACC range of 7-11% — the assumption most models hide, this one puts front and center.',
  },

  // ---- templates (remaining) ----
  'AI-TP-007': {
    verb: 'Filling this template with a real example',
    text:
      'Client: Fenwick Logistics, onboarding to the Pro plan.\n\n' +
      'Intake form: company size, current tools, and one required field — "biggest current pain point" (filled: "manual invoice reconciliation eating 6 hrs/week").\n' +
      'Welcome sequence: Day 0 — access + quickstart video. Day 2 — check-in tied directly to their stated pain point ("Have you tried the auto-reconciliation feature yet?"). Day 7 — feedback ask.\n' +
      'Kickoff checklist: 5 items, first one is "confirm the reconciliation workflow is connected" — sequenced to their actual reason for buying.',
  },
  'AI-TP-023': {
    verb: 'Filling this template with a real example',
    text:
      'Idea: "A tool that reminds freelancers to follow up on unpaid invoices."\n\n' +
      'Spec: Problem — freelancers lose ~$6k/year to invoices they simply forget to chase. User story — as a freelancer, I want automatic reminders at 7/14/30 days overdue so I don\'t have to track this manually. Scope — v1: email reminders only, no SMS. Out of scope — payment processing (use existing Stripe links).\n\n' +
      'Structured enough that both a human developer and a coding agent could pick it up and start building without a clarifying-questions round-trip.',
  },
  'AI-TP-031': {
    verb: 'Filling this template with a real example',
    text:
      'Decision: Use event sourcing for the order pipeline instead of direct state mutation.\n\n' +
      'Context: Need full audit trail for compliance; support team needs to reconstruct "what happened" for any order.\n' +
      'Options rejected: (1) Simple state + audit log table — rejected, audit log drifts from actual state over time. (2) Third-party audit-as-a-service — rejected, cost at our volume.\n' +
      'Consequences: Adds complexity to every write path; team needs event-sourcing training. Revisit if team velocity drops noticeably in the next quarter.',
  },
  'AI-TP-035': {
    verb: 'Filling this template with a real example',
    text:
      'Adopt: TypeScript strict mode (org-wide since Q2, proven, no rollback risk)\n' +
      'Trial: Bun as a Node replacement for internal tools (2 teams piloting, promising early startup-time numbers, not yet customer-facing)\n' +
      'Assess: WebAssembly for the image-processing pipeline (one spike done, unclear if it beats current native performance)\n' +
      'Hold: GraphQL federation (evaluated last year, complexity cost outweighed benefit at our team size — revisit only if team doubles)\n\n' +
      'Each ring carries the actual reasoning, not just a label.',
  },
  'AI-TP-044': {
    verb: 'Filling this template with a real example',
    text:
      'Course: Organic Chemistry II, Lecture 14 — Reaction Mechanisms\n\n' +
      'Cue column: "SN1 vs SN2 — key difference?" | "What determines E1 vs E2?"\n' +
      'Notes: SN1 — two-step, carbocation intermediate, favors tertiary substrates. SN2 — one-step, backside attack, favors primary substrates and strong nucleophiles...\n' +
      'Summary: This lecture\'s core insight — substrate structure predicts mechanism more reliably than nucleophile strength alone.\n\n' +
      'One page per lecture, review page auto-links related lectures by tagged topic.',
  },
  'AI-TP-047': {
    verb: 'Filling this template with a real example',
    text:
      'Fall semester: 5 courses, 17 credits.\n\n' +
      'Organic Chemistry II — Midterm Oct 14, Final Dec 12, current grade B+\n' +
      'Statistics — Problem set due weekly (Fridays), current grade A-\n' +
      'Running GPA: 3.6, auto-recalculates as each grade updates — shows the Chem II final is worth enough to move the semester GPA by 0.15 points either direction, which is exactly the kind of thing that\'s easy to lose track of without seeing it laid out.',
  },
  'AI-TP-051': {
    verb: 'Filling this template with a real example',
    text:
      'Meeting: Q3 Roadmap Review, 45 min\n\n' +
      'Agenda: 1) Review Q3 shipped items (10 min) 2) Discuss Q4 priorities — need a decision on mobile vs. API-first (20 min) 3) Assign owners for top 3 items (15 min)\n\n' +
      'Minutes: Decided — API-first for Q4, mobile pushed to Q1. Owners assigned: Priya (API v2 spec, due Fri), Marcus (Q1 mobile scoping doc, due next Tuesday).\n\n' +
      'Walked in with 3 agenda items, walked out with 1 decision and 2 owners with dates — nothing vague left hanging.',
  },
  'AI-TP-054': {
    verb: 'Filling this template with a real example',
    text:
      'SOP: Handling a customer refund request\n\n' +
      '1. Verify order is within the 30-day window (check order date in admin panel).\n' +
      '2. Confirm no prior refund on this order.\n' +
      '3. Process refund via Stripe dashboard, select reason code matching customer\'s stated issue.\n' +
      '4. Send confirmation email using template "Refund Confirmed."\n' +
      '5. Log in the refunds tracker sheet, tag with reason category for monthly review.\n\n' +
      'A new hire\'s first refund looks identical to one processed by someone with 3 years on the team.',
  },
  'AI-TP-063': {
    verb: 'Filling this template with a real example',
    text:
      'P&L: Revenue $84k/mo, COGS $18k, Gross Margin 79%. Operating expenses $67k/mo (Payroll $48k, Tools $6k, Marketing $13k).\n\n' +
      'Burn: $61k/mo net. Cash on hand: $854k. Runway: 14 months at current burn.\n\n' +
      'Cap table: Founders 62%, Seed investors 24%, Option pool 14% (9% allocated, 5% remaining).\n\n' +
      'Every number pulled from your actual figures, formatted the way a Series A investor expects to see it on slide one — not a template with brackets left for you to fill in later.',
  },
  'AI-TP-064': {
    verb: 'Filling this template with a real example',
    text:
      'Accounts: Checking $4,200, Savings $18,500, Investment $62,000, Credit card debt -$3,100.\n\n' +
      'Net worth: $81,600, up $2,400 from last month.\n\n' +
      '50/30/20 check: Needs 52% (slightly over), Wants 28%, Savings 20% — right on target for savings, needs category running a bit hot, mostly from a rent increase that kicked in this quarter.\n\n' +
      'Net-worth line updates automatically as you log each account, so the trend is visible without recalculating anything by hand.',
  },
}

/** True when a SKU has a free, zero-cost pre-written default demo. */
export function hasLibraryDemo(sku: string): boolean {
  return Object.hasOwn(DEMO_LIBRARY, sku)
}
