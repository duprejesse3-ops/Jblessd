# NicheAds nav links

Adds "NicheAds" next to the existing "MultiNicheADS"/"Agent studio" links in
three places, matching the exact pattern each already uses:

- `Index.html` — header nav button (with icon, next to the MultiNicheADS
  button) + footer link list.
- `netlify/Pages.ts` and `netlify/edge-functions/pages.ts` — the SEO-rendered
  page footer (these two files are exact duplicates in this repo already —
  both updated identically, confirmed with `diff` after editing).

⚠️ All three are edits to existing, larger files — diff against your current
versions rather than blindly overwriting, since you may have touched them
since this snapshot was cloned.

No new routes, no schema changes — purely making `/nicheads` (already live
and working) discoverable from the storefront itself.
