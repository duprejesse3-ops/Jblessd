-- Second wave of the title rewrite (see 20260926120000_seo_keyword_titles),
-- covering every product that wave left untouched.
--
-- Different treatment for branded names: MultiVault, MultiBøT, MultiSignal,
-- MultiCascade, MultiAugment, Closed Chair, $Token Agent, $Odds Agent,
-- Fieldhand, MultiWitness, MultiGuard, Meridian Host/Gate, and SWARM Intent
-- Autopilot are a deliberate branded product line, not generic labels —
-- replacing them outright would discard brand equity on purpose. These get
-- "Brand — long-tail descriptor" instead of a wholesale rename, the standard
-- e-commerce pattern for a named product that also needs to rank on intent.
--
-- Left untouched entirely (already specific/long-tail, or already a "Brand —
-- descriptor" shape): Local SEO Agency Blueprint, Faceless Video
-- Script-to-B-Roll Prompt Kit, Supplier PO & Inventory Sync, File Organizer
-- Agent, Overdue Invoice Chaser, Broken Link & Uptime Watchdog, Site Audit
-- Agent (Source Code), all five MultiConnect: * SKUs, Incident Postmortem
-- Automation, Investor-Ready Financials Template.
--
-- Safe to run: `name` is a display string, products are keyed by `sku`.

UPDATE products SET name = 'Meridian Host — Self-Hosted Storefront on Your Own Pi or Laptop' WHERE sku = 'AI-HOST-001';
UPDATE products SET name = 'Meridian Gate — Outbound AI Call Proxy & Audit Log' WHERE sku = 'AI-HOST-002';
UPDATE products SET name = 'SWARM Intent Autopilot — Proof-First Ad Copy from Real Search Intent' WHERE sku = 'AI-AB-070';
UPDATE products SET name = 'Brand Voice Memory Block — Reusable Client Voice Profiles for Agencies' WHERE sku = 'AI-AG-117';
UPDATE products SET name = 'Fieldhand — Contractor Correspondence & RFI Drafting Agent' WHERE sku = 'AI-AG-118';
UPDATE products SET name = 'MultiBøT — AI Vehicle Routing & Alternative-Route Planner' WHERE sku = 'AI-AG-067';
UPDATE products SET name = 'MultiSignal — Live News & Reddit Correlation Agent for Business Metrics' WHERE sku = 'AI-AG-115';
UPDATE products SET name = 'MultiCascade — Architect-Builder-Critic Idea Execution Agent' WHERE sku = 'AI-AG-112';
UPDATE products SET name = 'MultiAugment — Decision-Support Agent That Never Acts For You' WHERE sku = 'AI-AG-113';
UPDATE products SET name = 'Closed Chair — Syllabus-Only AI Office Hours Agent' WHERE sku = 'AI-AG-111';
UPDATE products SET name = '$Token Agent — Sourced Crypto & Stock Research Briefs' WHERE sku = 'AI-AG-094';
UPDATE products SET name = '$Odds Agent — Polymarket Price-vs-News Divergence Watch' WHERE sku = 'AI-AG-114';
UPDATE products SET name = 'MultiWitness — Tamper-Evident Hash-Chain Log for AI Agents' WHERE sku = 'AI-CN-006';
UPDATE products SET name = 'MultiGuard — One-Dashboard Kill Switch for Every Connector' WHERE sku = 'AI-CN-007';
UPDATE products SET name = 'MultiVault — Local Encrypted Context Search for AI Agents' WHERE sku = 'AI-CN-008';
