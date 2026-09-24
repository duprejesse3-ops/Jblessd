# Clear the backlog of already-queued duplicate posts

One file: `netlify/database/migrations/20260903170000_dedupe_queued_velocity_posts.sql`

## Why you're still seeing duplicates after the last fix

That fix (in `pickSource()`) stops **new** duplicate posts from being
generated — it doesn't retroactively clean out posts that were already sitting
in `velocity_posts` with `status='queued'` before the fix deployed. Your
poster functions (`x-poster.mts`, `bluesky-poster.mts`, `reddit-poster.mts`)
each only post one queued row per scheduled run, so if several duplicate
copies of the same run got queued before the fix landed, they trickle out one
at a time, run after run — which is exactly what the post you just showed me
looks like: a leftover from the backlog, not a new bug.

## What this does

Deletes any `queued` row whose exact platform+content text already exists in
a `posted` row. Only removes pure duplicates of something already sent —
doesn't touch posting history, doesn't touch anything that isn't an exact
repeat. Same idempotent one-time-cleanup pattern your repo already uses
(`20260829200000_dedupe_active_scenarios.sql`) — safe to run more than once.

## After this runs
The queue should be clear of the old duplicates. Combined with the earlier
`pickSource()` fix, no new ones should generate either. If you see another
repeat after both of these are live, it'd be worth a fresh look rather than
assuming it's more backlog.
