# Rebuilt: site-health-agent scheduled function

Drop into your repo root — one new file, one new path, nothing overwritten.

## What was missing

`netlify/lib/site-health.mts` (the check logic), `netlify/functions/site-status.mts`
(the read endpoint), the admin console's `site_health` tool, and
`netlify/lib/agent-diagnosis.mts` (which already has `'site_health_runs'` wired
into its cached-recommendation logic) all existed and expected a scheduled
function to run the checks and write rows to `site_health_runs`. That function
itself was missing from the repo. Nothing errored — `/api/site-status` just kept
serving the last real row forever, which is why the 401 data you found was
frozen at Aug 26 with no error anywhere pointing at why.

## What this adds

`netlify/functions/site-health-agent.mts` — mirrors `discovery-crawler.mts`'s
structure exactly, since that one already does this correctly for a different
table:

1. Runs `inspectSite()` (homepage, catalog API, review API, sitemap)
2. Reuses the previous recommendation when the set of failing checks hasn't
   changed (`cachedRecommendation`), so a steady-state problem costs one LLM
   call instead of one every run — same cost-control pattern already used
   elsewhere in your codebase
3. Otherwise asks Claude for a fresh recommendation. I added one instruction
   here that the discovery-crawler prompt doesn't need: if every check fails
   with the same status — especially if the homepage itself fails alongside
   everything else — the model is told to say that plainly points at a
   platform-level block (e.g. Netlify's site-wide password protection) rather
   than guessing at per-service credential rot, which is what produced the
   misleading recommendation text you saw on Aug 26
4. Writes the run to `site_health_runs`
5. Prunes runs older than 30 days, once a day (same gating pattern as
   `discovery-crawler.mts`)

**Schedule:** hourly (`0 * * * *`), matching the roughly-hourly spacing
already visible in your existing `site_health_runs` history — this restores
the cadence other parts of the system were already built around, not a new
one. No collision with any other function's schedule.

## Verification
Transpile-checked with esbuild — clean, no syntax errors. I can't trigger a
live Netlify scheduled run from here, so the first real confirmation is
either watching for a new row in `/api/site-status` after your next deploy,
or triggering it manually if your Netlify setup allows invoking scheduled
functions on demand.
