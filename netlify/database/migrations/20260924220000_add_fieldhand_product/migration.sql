-- Adds Fieldhand (AI-AG-118) to the catalog, and its niche: this is the
-- first product for contractors/trades, so 'contractors' is a new niche
-- value (no CHECK constraint on the column — the app-level union type in
-- netlify/lib/catalog.mts and netlify/edge-functions/pages.ts is updated in
-- the same change).
--
-- Fieldhand is a real, working web app the buyer downloads as one
-- self-contained HTML file (packages/fieldhand/), same pattern as the other
-- downloadable-app products (see 20260901130000_add_multiwitness_product) —
-- not a document or prompt pack. Filed under 'agents' rather than a new
-- category: it's an AI-assisted drafting tool, same shape as the other
-- Agent Configs products.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved) VALUES
  (
    'AI-AG-118',
    'Fieldhand',
    'agents',
    'contractors',
    'Web app · offline HTML download · one-time license',
    29,
    'Drafts contractor correspondence — claim responses, RFIs, RFPs, change orders, notices of delay, punch-list follow-ups — in plain contractor voice, then runs it through a built-in scrub pass that strips stock AI phrasing, em dashes, and hidden Unicode characters before it ever leaves the page. Upload any file type as source material; download the whole tool as one offline HTML file when you''re done.',
    '20 letter types across bids, RFIs, claims, and closeout · any-format upload (text read in, photos sent as images) · built-in AI-phrasing scrubber with a change report · offline-capable download',
    '~30 min saved per letter drafted'
  )
ON CONFLICT (sku) DO NOTHING;
