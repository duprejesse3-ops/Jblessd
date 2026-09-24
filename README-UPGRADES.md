# MultiNiche AI upgrades — apply by extracting into repo root

This zip mirrors your repo's actual folder structure. Extract it straight
into the root of your `duprejesse3-ops/Jblessd` checkout and the 6 changed/
new files land at their real paths, overwriting the old versions:

```
Index.html
catalog.mts
netlify/lib/catalog.mts
netlify/lib/db.mts
netlify/functions/products.mts
netlify/database/migrations/20260924190000_add_time_saved_and_local_seo_product.sql
```

## Steps

```bash
cd /path/to/your/Jblessd
unzip -o multinicheai-upgrades.zip -d .
git status        # confirm only the 6 files above show as changed
git add -A
git commit -m "Product page fix + featured kit + local SEO agency blueprint + 2 new products"
git push
```

(`-o` overwrites without prompting — safe here since these are the only
files this zip touches.)

If you're pasting through GitHub's web editor instead of git, open each of
the 6 files above and paste in the matching file from this zip.

## What's in the changes

- **Product page**: live-demo section moved above the spec table; new
  conditional "TIME SAVED" spec row.
- **Featured kit**: "AI Solopreneur Operations Kit" section with one-click
  add-to-cart (Deep Work Prompt Pack + Meeting Notes Agent + OKR Tracker,
  15% bundle discount applies automatically via your existing cart logic).
- **3 new/expanded products** (in the migration + both fallback catalog
  files):
  - `AI-AB-071` **Local SEO Agency Blueprint** — $75. Expanded from a
    single audit blueprint into a full service system: Maps/competitor
    audit, GBP checklist, automated review-response drafts, white-label
    monthly client report, and a cold-outreach script. One license,
    unlimited clients.
  - `AI-PP-116` **Faceless Video Script-to-B-Roll Prompt Kit** — $24.
  - `AI-AG-117` **Brand Voice Memory Block** — $27.
  - Plus backfilled "time saved" estimates on 4 existing automations
    (Inbox Zero, Content Calendar Autopilot, Personal CRM, Code Review
    Digest).

## One manual step

**Run the migration against your live database** — it doesn't run itself
on deploy. Check how your other files under
`netlify/database/migrations/` get applied in your setup before merging,
since this one creates the `time_saved` column and inserts the 3 new
products.

## Worth checking after it's live

- Open the 4 backfilled products and confirm the "TIME SAVED" row shows.
- Add the 3 kit items and confirm 15% still applies automatically.
- Search "Local SEO" / browse Marketers to confirm the new products show up.
