-- Supersedes 3 of the renames from 20260926140000_dedupe_file_organizer_and_more_titles.
-- That migration only had name/category/niche/price for these DB-only
-- products (pulled from the live API's product LIST view) and guessed at
-- reasonable long-tail phrasing. Now that the full blurb/spec/format is in
-- hand for each, these three get corrected to match what the product
-- actually says about itself, instead of the earlier guess:
--
--   AI-AB-018: guessed "Customer Support Ticket Triage Copilot" -> its own
--     format line says "Zendesk + Intercom blueprint", so that's named
--     directly instead of a generic "customer support" placeholder.
--   AI-AG-022: guessed "Email Negotiation & Counter-Offer Agent" -> its own
--     blurb says it negotiates "pricing and scheduling", not email
--     counter-offers specifically, so the guess was simply wrong.
--   AI-AG-066: guessed "MultiAgents — Downloadable, Customer-Customizable AI
--     Agent App" from the product line's general description in prior
--     conversation -> its own format field just says "Digital download" and
--     its blurb emphasizes "a fully custom agent... not locked to one job",
--     so the descriptor is corrected to match its actual copy.
--
-- Two more get a first-time rename now that their spec is known:
--   AI-PP-019: format names "gpt-image-1 + Gemini" and the blurb is about
--     on-brand product/ad visuals -- both now named directly.
--   AI-PP-021: blurb explicitly says "Claude & GPT" -- named directly.
--   AI-AG-090: blurb describes real-time, tone-preserving translation --
--     named directly instead of the generic original.
--
-- Everything else added in the same wave (Realtime Voice Agent Blueprint,
-- RAG Knowledge Base Agent, Multi-Agent Research Swarm, Autonomous SEO
-- Content Agent, AI Product Spec Template, Meeting-to-CRM Automation,
-- Global Content Localizer, Multilingual Support Inbox) is left as its
-- original name -- already specific enough that a further rewrite would be
-- cosmetic, not a real improvement.

UPDATE products SET name = 'Zendesk & Intercom Ticket Triage Copilot' WHERE sku = 'AI-AB-018';
UPDATE products SET name = 'Pricing & Scheduling Negotiation Agent' WHERE sku = 'AI-AG-022';
UPDATE products SET name = 'MultiAgents — Custom Task-Specific AI Agent Builder' WHERE sku = 'AI-AG-066';
UPDATE products SET name = 'On-Brand Product & Ad Image Prompt Pack (gpt-image-1 + Gemini)' WHERE sku = 'AI-PP-019';
UPDATE products SET name = 'Prompt Debugging Playbook for Claude & GPT' WHERE sku = 'AI-PP-021';
UPDATE products SET name = 'AI Language Bridge — Real-Time, Tone-Preserving Translation Agent' WHERE sku = 'AI-AG-090';
