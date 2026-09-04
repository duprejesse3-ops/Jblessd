-- One-time cleanup, round two: the earlier cleanup
-- (20260903170000_dedupe_queued_velocity_posts) only removed a queued row
-- when its exact text matched something already posted. That missed queued
-- rows generated before the pickSource dedup fix that describe the SAME
-- already-covered source (source_type + source_id) but with different
-- wording — those kept trickling out one at a time as genuine-looking but
-- stale "new" posts about events already covered.
--
-- Scoped to rows queued BEFORE the dedup fix landed (same cutoff as the
-- prior cleanup migration): anything queued after that point is trusted —
-- pickSource() itself now guarantees it never picks an already-posted
-- source, and a still-queued row for a different platform on a fresh event
-- is normal (posters run on their own independent schedules), not stale.
-- Without this cutoff, deleting by source alone would also wipe out a
-- legitimate, still-pending platform variant of a brand-new post just
-- because a different platform's copy of the same fresh event already
-- went out first.
--
-- Safe to run more than once — idempotent.

DELETE FROM velocity_posts vp
WHERE vp.status = 'queued'
  AND vp.created_at < '2026-09-03 17:00:00+00'
  AND EXISTS (
    SELECT 1 FROM velocity_posts posted
    WHERE posted.status = 'posted'
      AND posted.source_type = vp.source_type
      AND posted.source_id = vp.source_id
  );
