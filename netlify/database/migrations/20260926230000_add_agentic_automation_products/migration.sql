-- Adds three new real-code automation/agent products, tied to the store's
-- rebrand toward automation & software: an autonomous, multi-step research
-- agent (fetch -> extract -> enrich -> write, unattended across a whole
-- lead list), an inbound-lead scoring + Slack routing automation, and a
-- transcript-to-content repurposing engine. Uses existing niches
-- ('sales', 'marketers') and existing categories ('agents', 'automations')
-- -- no new enum values needed.
--
-- Ships the same way as the other real-code automation products (Overdue
-- Invoice Chaser, Broken Link & Uptime Watchdog, ...): a runnable Node
-- package the buyer downloads as a .zip, not a document or a Make/Zapier
-- blueprint they assemble themselves. See packages/lead-research-agent/,
-- packages/lead-score-router/, packages/content-repurposing-engine/, and
-- netlify/lib/product-archive.mts.
--
-- llm_compatibility is set to plain "Claude" for all three, not the usual
-- "Claude, ChatGPT & Gemini" blanket default -- the shipped code only calls
-- Anthropic's Messages API directly (see each package's lib/claude-client.mjs),
-- so claiming ChatGPT/Gemini compatibility here would be a claim the code
-- doesn't back up. A buyer who wants another provider can swap that one file.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved, llm_compatibility, meta_description) VALUES
  (
    'AI-AG-127',
    'Lead Research & Enrichment Agent',
    'agents',
    'sales',
    '.zip · Node script + Claude API, zero dependencies · one-time license',
    49,
    'Reads a CSV of company domains, fetches each company''s real homepage, and hands the extracted text to Claude for a four-field enrichment: industry guess, any size signal it can find, a one-sentence value prop, and a contact-page guess. Not a lookup checklist a rep works through by hand — a multi-step agent that does the fetch, extract, and enrich loop on its own for every row in your list, and remembers which domains it has already researched so growing a list over time never re-spends an API call.',
    'Plain-fetch homepage scrape (no headless browser) + HTML-to-text extraction + Claude-based four-field enrichment (industry, size signal, value prop, contact page) + per-domain enrichment cache · Node 18+, zero dependencies · GitHub Actions workflow included',
    '~10-15 min saved per company researched by hand',
    'Claude',
    'Fetches each lead''s real homepage and has Claude extract industry, size signal, value prop, and a contact-page guess — an agent, not a checklist.'
  ),
  (
    'AI-AB-128',
    'Lead Score & Router',
    'automations',
    'sales',
    '.zip · Node script + Claude API, Slack routing · one-time license',
    39,
    'Scores every new inbound lead against your ideal customer profile with Claude, then posts it straight to the right Slack channel — hot leads somewhere your reps actually watch, warm leads to nurture, everything else logged and left alone. Not a scoring spreadsheet with a couple of weighted fields: it reads the whole lead, including their own message, and routes it the moment it''s scored. Tracks which leads it has already routed, so a repeated export never posts the same lead twice.',
    'Claude-based 0-100 ICP scoring + configurable tier thresholds + per-tier Slack webhook routing + file-based dedupe state, no database · Node 18+, zero dependencies · GitHub Actions workflow included',
    '~5 min saved per lead, per manual triage pass',
    'Claude',
    'Scores inbound leads against your ICP with Claude and routes each one to the right Slack channel by tier, automatically.'
  ),
  (
    'AI-AB-129',
    'Content Repurposing Engine',
    'automations',
    'marketers',
    '.zip · Node script + Claude API, zero dependencies · one-time license',
    45,
    'Turns one transcript — a podcast episode, a webinar, a recorded talk — into a blog post draft, a newsletter blurb, and a batch of short social clips, in one run. Each prompt is already tuned for its format: the blog post is organized around what was actually discussed and quotes the transcript directly, the newsletter leads with the single most useful idea, and the social clips are standalone lines worth screenshotting. Not three separate trips to a chat window — one command, three ready-to-edit files.',
    'Three tuned Claude prompts (blog, newsletter, social clips) + transcript truncation for long input + numbered-clip parser + per-format output files · Node 18+, zero dependencies · GitHub Actions workflow included',
    '~1.5-2 hrs saved per episode repurposed',
    'Claude',
    'Turns a transcript into a blog post draft, a newsletter blurb, and social clips in one run — three ready-to-edit files, one command.'
  )
ON CONFLICT (sku) DO NOTHING;
