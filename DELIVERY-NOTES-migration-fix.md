# Heads up: deleting the migration made this worse, not better

You already deleted `netlify/database/migrations/20260924190000_add_time_saved_and_local_seo_product.sql`
from the repo (commit `f889638`). I need to flag this plainly: **that will
not fix your build.** It trades one Netlify Database lock error for
another. Confirmed against Netlify's own troubleshooting docs
(https://docs.netlify.com/build/data-and-storage/netlify-database/troubleshooting/):

- Before deleting: `migration "..." has been modified after being applied`
- After deleting: `migration "..." has been removed after being applied`

Both are the same underlying rule: **once a migration has run against your
production DB, Netlify tracks it and will not let the repo disagree with
that record** — whether by editing the file or removing it. The next deploy
will still fail, just with the new error instead.

## The only real fix (I can't do this part for you)

```
netlify database migrations pull
```

Run this from your repo root with the Netlify CLI installed and logged in
(`netlify link` first if this repo isn't linked yet). It downloads the
*exact* content of every applied migration from Netlify's own record and
restores your local files to match — including recreating
`20260924190000_add_time_saved_and_local_seo_product.sql` with whatever
content actually ran, byte for byte.

I genuinely can't produce that file myself — it's not something I can
reconstruct or guess my way into; Netlify's checksum is exact, and only
this command has access to what's actually on record for your database.
There's no CLI "repair"/"resync" shortcut either — I checked the docs
specifically for one.

## Step by step

1. `netlify database migrations pull` — restores the deleted file exactly
   as it was applied. **Don't hand-edit what comes back.**
2. Drop in the attached `netlify/database/migrations/20260924210000_fix_local_seo_product_data.sql`
   (already in this zip, correct folder). This is a brand-new migration —
   never applied before, so it carries no checksum baggage — and it
   `UPSERT`s (`ON CONFLICT (sku) DO UPDATE`) AI-AB-071 / AI-PP-116 /
   AI-AG-117 to the correct final price/blurb/data regardless of what
   version step 1 restores. So it doesn't matter whether the restored file
   turns out to be an old draft with the wrong price, or already correct —
   this migration forces the end state either way.
3. Commit both files and push:
   ```
   git add netlify/database/migrations/20260924190000_add_time_saved_and_local_seo_product.sql \
           netlify/database/migrations/20260924210000_fix_local_seo_product_data.sql
   git commit -m "restore locked migration via CLI pull, add corrective upsert"
   git push
   ```

That should be the last build failure from this — once step 1 restores the
file, its content will match what Netlify has on record permanently (you
won't touch it again), and every correction from here on goes in new,
forward-only migrations like step 2's.
