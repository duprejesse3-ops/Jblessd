-- Adds the Site Audit Agent (Source Code) product and opens the "stores" niche.
--
-- This SKU is different in kind from everything before it. Every other product
-- in the catalog is content — prompts, blueprints, templates, agent configs —
-- generated or authored as a document. This one is a working piece of software:
-- packages/site-audit-agent, the same zero-dependency engine that watches this
-- store, delivered as complete runnable source under a perpetual buy-once
-- license. The buyer runs it on their own machine, their own cron, their own CI,
-- or their own serverless host, with no account here and no subscription.
--
-- Because the exact bytes are the product, its deliverable is hand-authored
-- rather than model-written: netlify/lib/deliverables.mts routes AI-AG-065
-- through a per-SKU override backed by netlify/lib/site-audit-source.mts, and
-- netlify/lib/ai-deliverable.mts skips the AI upgrade pass for it entirely.
--
-- Priced well above the rest of the catalog on purpose: it is the only item that
-- ships source, and a perpetual license to a maintenance tool is worth more than
-- a prompt pack. It is also the only item with no ongoing cost to us once sold.
--
-- Roll-forward only. It touches no existing seed and inserts one new SKU;
-- ON CONFLICT (sku) DO NOTHING keeps it idempotent alongside the founding
-- catalog, waves two through four, the finance line, and owner-listed products.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-065', 'Site Audit Agent (Source Code)', 'agents', 'stores', 'Node.js source · zero dependencies · perpetual license', 79, 'The maintenance agent that watches this store, rebuilt to run on any site. Sixteen checks, three schedulers, no account and no subscription — you own the code.', 'Runs on Node 18+ anywhere · CLI, cron, CI or serverless')
ON CONFLICT (sku) DO NOTHING;
