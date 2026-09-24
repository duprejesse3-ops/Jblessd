-- One-time cleanup: velocity-engine.mts's pickSource() previously had no
-- check for whether a scorecard run or proof had already been posted about
-- (fixed separately, see the velocity-engine.mts dedup patch). Before that
-- fix landed, several runs picked the same already-posted-about source and
-- queued fresh copies of essentially the same content. Those old queued
-- rows are still sitting in velocity_posts with status='queued', and since
-- each poster function only posts one queued row per scheduled run, they've
-- been trickling out one at a time even after the generation-side fix —
-- which is what kept showing up as repeat posts.
--
-- This removes any queued row whose exact text (platform + content) already
-- exists in a posted row. It deliberately does NOT touch already-posted
-- rows — those already went out and stay in the history as-is.
--
-- Safe to run more than once — it's idempotent, and only ever removes rows
-- that are pure duplicates of something already posted.

DELETE FROM velocity_posts vp
WHERE vp.status = 'queued'
  AND EXISTS (
    SELECT 1 FROM velocity_posts posted
    WHERE posted.status = 'posted'
      AND posted.platform = vp.platform
      AND posted.content = vp.content
  );
