# New "Just Added" homepage section

## What changed

One file: `Index.html`.

A new strip on the homepage, "Just added," sitting above the existing
"Showcase" strip and above the full catalog grid. It shows the 4 most
recently added products.

## Why it's honest, not just decorative

The "Trending" badge already on your cards is explicitly tied to a real
signal — `trend-scanner.mts` only marks something trending when it actually
matches a live X trend or a real spike in your own site traffic (see the
comment at `applyFeaturedProducts()` in `Index.html`). Manually forcing new
products into that system would mean writing a fake "trending" reason for
something that isn't actually trending.

So "Just added" is a separate, new badge/section instead, and it's driven by
real data with zero manual curation: `/api/products` (via `loadCatalog()` in
`netlify/lib/db.mts`) already returns products `ORDER BY id`, and `id` is a
serial column that only increments — so the last entries in that array are,
genuinely, whatever was added to your database most recently. No new column,
no migration, no separate "featured" flag to remember to update. Add a
product through the normal listing flow and it shows up here automatically;
nothing to maintain.

## What's in the diff

- New CSS: `.new-badge` (gold, distinct from the teal `.trend-badge`) and
  `.card.is-new` for a matching border highlight.
- New HTML: a `<h2>Just added</h2>` + `<section id="just-added">` above the
  existing Showcase section.
- `buildCard()`: added a hidden `<span class="new-badge">New</span>`,
  following the exact same hidden-by-default pattern the existing
  `.trend-badge` already uses.
- Two new functions: `pickJustAdded(products, max)` (takes the last N items
  from the already-ordered array and reverses them to newest-first) and
  `renderJustAdded(products)` (builds cards into `#just-added` and reveals
  the badge on each one).
- `loadCatalogFromApi()`: now also calls `renderJustAdded(data.products)`
  alongside the existing `renderShowcase(data.products)`.

Shows 4 products by default — change the `4` in
`pickJustAdded(products, 4)` (search for `renderJustAdded` in the file) if
you want more or fewer.

## Apply

```
cp Index.html <your repo>/Index.html
git add Index.html
git commit -m "add a real, data-driven 'Just added' section to the homepage"
git push
```

No migration, no new dependency, no env var, no backend change at all —
purely front-end.

## Verified before sending

- Extracted every inline `<script>` block from the file and ran
  `node --check` on it — syntax is clean.
- Ran `pickJustAdded()` standalone against a mock 10-item array: correctly
  returns the last 4 items in newest-first order, degrades gracefully with
  fewer than 4 products, and returns `[]` for an empty/malformed catalog
  (matching the existing `pickShowcase()` failure behavior, so a bad API
  response leaves this section empty rather than breaking the page).

One thing I couldn't verify from here: what it actually looks like rendered
in a browser (this sandbox can't load your live site's CSS context/fonts to
screenshot it) — worth a quick look after deploy to confirm the strip reads
well at your default 4-card width.
