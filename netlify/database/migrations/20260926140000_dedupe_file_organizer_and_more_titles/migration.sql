-- 1) Removes AI-AG-093, a duplicate of AI-AG-120 (both "File Organizer
--    Agent", same category/niche/price). AI-AG-120 is kept: it's the fuller,
--    more complete copy (has timeSaved, a more specific blurb/spec) and is
--    the one already tracked in this repo's own migration history
--    (20260925180000_add_file_organizer_product). AI-AG-093 exists only in
--    the live DB — it was listed through the storefront's "List a new
--    product" flow, which writes straight to Postgres and never goes
--    through a git migration, so it never showed up in this codebase at all
--    until fetched from the live API. Any orders already placed against
--    AI-AG-093 are unaffected by this delete; only the catalog listing goes.
--
-- 2) Rewrites three of the remaining DB-only products (also never tracked in
--    git) whose names were genuinely generic. The other DB-only products
--    (Realtime Voice Agent Blueprint, RAG Knowledge Base Agent, Multi-Agent
--    Research Swarm, Image Prompt Studio, Autonomous SEO Content Agent,
--    Prompt Debugging Playbook, AI Product Spec Template,
--    Meeting-to-CRM Automation, AI Language Bridge, Global Content
--    Localizer, Multilingual Support Inbox) are left as-is: this migration
--    only has their name/category/niche/price from the live API, not their
--    blurb/spec, so sharpening them further risks inventing a mechanism
--    (a specific model, platform, or integration) that isn't actually true
--    of the product. MultiAgents gets the same "Brand — descriptor" pattern
--    as the other Multi* branded products, using the description the user
--    already gave for it (a downloadable, customer-customizable AI agent
--    app), not an invented one.

DELETE FROM products WHERE sku = 'AI-AG-093';

UPDATE products SET name = 'Customer Support Ticket Triage Copilot' WHERE sku = 'AI-AB-018';
UPDATE products SET name = 'Email Negotiation & Counter-Offer Agent' WHERE sku = 'AI-AG-022';
UPDATE products SET name = 'MultiAgents — Downloadable, Customer-Customizable AI Agent App' WHERE sku = 'AI-AG-066';
