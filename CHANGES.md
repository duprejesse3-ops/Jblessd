# Velocity engine (trend-aware + image variety) + scorecard color fix

Drop this folder's contents into your repo root, overwriting the matching
paths. Nothing here renames or moves anything.

## Files included

**Velocity engine — senses trends, varies images:**
- `netlify/functions/velocity-engine.mts`
- `netlify/functions/ad-image.mts`
- `netlify/functions/x-poster.mts`
- `netlify/functions/bluesky-poster.mts`
- `netlify/lib/image-render.mts`
- `netlify/database/migrations/20260903120000_add_velocity_trend_and_image_variant.sql`

**Scorecard color fix:**
- `netlify/edge-functions/pages.ts`
- `netlify/Pages.ts`

---

## Velocity engine changes

**The gap:** `trend-scanner.mts` already runs every 6h and records genuine
trend matches to specific products in `trend_signals` — but
`velocity-engine.mts` never looked at that table, only using proof/scorecard
data. And `ad-image.mts` had exactly one fixed layout per size, so every
post looked visually identical.

- **`velocity-engine.mts`** — looks up the strongest recent (24h)
  `trend_signals` match for the chosen post's product. If found, it's added
  to the fact sheet as *optional* context — the model is told to use it only
  if it makes for a genuinely natural, timelier hook, and to ignore it
  otherwise. Your real proof/scorecard data stays the mandatory hook either
  way. Also picks one of 3 image layout variants each run, checking the last
  2 posts so it doesn't repeat the same look back-to-back. Records which
  trend (if any) and which variant were used.
- **`ad-image.mts`** — added a `variant` query param (`0`/`1`/`2`) with three
  distinct visual treatments (original / reversed layout / name-forward
  layout) for both landscape and square/portrait sizes. Defaults to `0` when
  missing, so any existing creative URLs without the param render exactly as
  before.
- **`image-render.mts`** — `fetchCreativePng()` takes an optional 4th
  `variant` argument, passed through to `/api/ad-image`.
- **`x-poster.mts` / `bluesky-poster.mts`** — now select `image_variant`
  alongside existing columns and pass it through, so the posted image
  matches the variant the engine picked. (Reddit posts text-only already, so
  no change needed there.)
- **Migration** — adds `used_trend_term` (nullable text) and `image_variant`
  (int, default 0) to `velocity_posts`. Additive with a default, safe
  against already-queued rows.

## Scorecard color fix

`renderScorecard()` in `pages.ts` used a hardcoded `#ff786e` (old
coral-pink) for the "failed" outcome badge and an error message, left over
from before the navy/teal/brass rebrand — everything else on the page
correctly used the current CSS variables. Added `--danger:#FF2A2A` (the
site's actual current brand red, same as the logo mark) to `:root` and
pointed both spots at it.

`netlify/Pages.ts` at repo root was a stale, out-of-sync duplicate of
`netlify/edge-functions/pages.ts` still on the *entire* old red/coral
palette. Synced it byte-for-byte with the corrected file.

## Verification
All modified `.mts`/`.ts` files were transpile-checked with esbuild
(TypeScript syntax valid, no parse errors) before packaging. No live
DB/Netlify environment here, so a staging deploy is worth doing before
either change goes live on the schedule.
