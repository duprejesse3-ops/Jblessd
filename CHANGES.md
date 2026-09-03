# Velocity engine — stop reposting the same run

One file, drop into your repo root, overwrites `netlify/functions/velocity-engine.mts`.

## The bug

`pickSource()` always grabbed the single most recent scorecard run (within a
2-day window) or, failing that, the single most recent proof — with no check
for whether that exact run had already been posted about. If your benchmark
scenario doesn't get a fresh run every day, the same run stays "most recent"
for its entire 2-day window, so the engine just kept generating new posts
about the identical old event — which is what you were seeing: the same
"433ms, Sep 1, 22:36 UTC" run showing up in post after post.

Proofs had it worse — no time window at all, so a single old proof could
resurface indefinitely with nothing ever aging it out.

There was also a second, related bug: scorecard posts stored the product's
**SKU** as `source_id`, not the run's own unique id. A naive "don't repeat
this source_id" fix on top of that would have blocked ALL future posts about
that product forever after the first one, not just that specific run.

## The fix

- Both queries now exclude anything already present in `velocity_posts` for
  that source type, checked against the run/proof's own unique id.
- Scorecard posts now store the run's real unique id (`benchmark_runs.id`)
  as `source_id`, not the sku — so future runs of the same product post
  fine, only the literal same run is excluded.
- When nothing fresh exists (everything recent already covered, or no data
  yet), the function logs that clearly and skips the run rather than
  repeating old content — same graceful no-op behavior as before, just an
  honest reason now.

Nothing else changed — trend context, image variety, and everything from the
last patch are untouched.

## Verification
Transpile-checked with esbuild — clean, no syntax errors. Worth watching the
next couple of scheduled runs to confirm it either posts about a genuinely
new run or skips cleanly instead of repeating.
