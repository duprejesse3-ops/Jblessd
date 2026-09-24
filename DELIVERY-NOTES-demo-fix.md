# Fix: demo was inventing specific business/review details it wasn't supposed to

## What was wrong

You screenshotted the "Local SEO Agency Blueprint" (AI-AB-071) default demo
showing a fabricated client — "Bright Smile Dental, Tacoma WA" — with invented
reviewer names (Marisa T., Kevin L.), quoted review text, and star ratings.
None of that is real; nothing in this environment can fetch real Google
Business Profile reviews (no Maps/Places API key configured).

That specific product's own brief (`SKU_RUN_BRIEF['AI-AB-071']` in
`product-app.mts`) already says, explicitly, not to do this — its "Scope
lock" says the review-response/GBP part should be explained conceptually
"without inventing specific business names, review counts, or ratings that
were never fetched." But `netlify/functions/demo.mts` was also appending a
second, generic instruction right after it: "Invent realistic details (names,
numbers, content) so it feels like a real run." Those two rules directly
contradict each other, and the model followed the generic one.

This wasn't unique to AI-AB-071 — every SKU with its own strict
`SKU_RUN_BRIEF` (Closed Chair, MultiCascade, $Odds Agent, MultiSignal, and
AI-AB-071) has this same conflict, since each of those briefs already spells
out its own detailed rules about what can and can't be invented, and the
generic line was undercutting all of them equally.

## The fix

One file changed: `netlify/functions/demo.mts`.

- The generic "invent realistic details" instruction now only applies to
  products using the generic category playbook (no `SKU_RUN_BRIEF` entry).
  For any SKU with its own strict brief, the system prompt instead says that
  brief's own rules govern completely, and explicitly wins over any general
  instinct to "make it feel real."
- `CACHE_VERSION` bumped from `v1` to `v2`. This matters as much as the code
  fix: the fabricated demo you saw was being served from the Blobs cache, so
  without the bump, that same bad cached text keeps showing even after this
  deploys — the cache key changing forces every default demo to regenerate
  fresh under the corrected prompt.

## Apply

```
cp netlify/functions/demo.mts <your repo>/netlify/functions/demo.mts
git add netlify/functions/demo.mts
git commit -m "fix demo: SKU-specific invention rules now override the generic one; bump cache"
git push
```

No migration, no new dependency, no env var.

## Verified before sending

- `tsc --noEmit` — clean on this file; the only errors are pre-existing and
  unrelated (same `host` category / node_modules typing gaps you'd see on an
  untouched clone).
- Compiled with esbuild — the file parses and transforms cleanly.
- Manually traced the new conditional: SKUs with a `SKU_RUN_BRIEF` entry
  (AI-AB-071, Closed Chair, MultiCascade, $Odds Agent, MultiSignal) get the
  deferring line; every other SKU keeps the original "invent realistic
  details" behavior unchanged.

One thing I couldn't verify from here: an actual live re-run of the demo
against the real Claude model and Blobs cache — that needs a real deploy.
After this lands, click into the AI-AB-071 demo again (it'll regenerate
since the cache key changed) and confirm the review-response section now
explains the blueprint conceptually instead of naming a fake client/reviews.
