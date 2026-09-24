# SEO Agency Blueprint — real live-scan upgrade

Builds on the upgrades you already merged (`993878d site upgrades`). This
zip is a small, self-contained addition on top of that — 7 files, mirrors
your repo's real folder structure. Extract into your repo root and it lands
in place, overwriting only these:

```
catalog.mts
netlify/lib/catalog.mts
netlify/lib/product-app.mts
netlify/lib/seo-live-context.mts          (new file)
netlify/functions/demo.mts
netlify/functions/run-product.mts
netlify/database/migrations/20260924190000_add_time_saved_and_local_seo_product.sql
```

```bash
cd /path/to/your/Jblessd
unzip -o multinicheai-seo-realscan.zip -d .
git add -A
git commit -m "Local SEO Agency Blueprint: real live-scan, not a simulated demo"
git push
```

## What this actually fixes

You caught the free "Watch it run" demo inventing a wrong page title and
claiming your meta description was missing — it wasn't. Root cause: every
product's free demo is Claude improvising a plausible-sounding run from the
product's description, not checking anything real. Two products already had
a real-data exception to that (MultiSignal, $Odds Agent — they fetch live
headlines/prices before answering); this extends the same pattern to the
Local SEO Agency Blueprint, and — because it only ever existed as a stub
before this — properly wires it into the **free demo** too, not just the
paid app (the two existing examples only had the real-fetch wired into the
paid `run-product.mts` path).

## What's new

**`netlify/lib/seo-live-context.mts`** — a real, dependency-free on-page SEO
scanner. Given a URL (pulled out of free text or a form field), it:
- Fetches the real page (6s timeout, 900KB cap, basic SSRF guard — blocks
  localhost/private IPs, only allows http/https)
- Parses real title, meta description, canonical tag, H1s, JSON-LD
  `@type`s, rough word count, image alt-text coverage
- Checks robots.txt reachability and whether it declares a sitemap
- Explicitly does NOT check Google Business Profile or competitor listings
  (no Maps/Places API key configured in this environment) — and says so, so
  the prompt that uses this never invents that part

Verified end-to-end against a real live site before shipping (not just unit
logic) — genuinely fetches, parses, and reports real findings.

**`netlify/functions/demo.mts`** — when a shopper tries this product's free
"Live Proof" and mentions their own site, it now calls the real scanner
first and grounds Claude's response in the actual findings, with an
explicit rule never to contradict or invent facts beyond what the scan
returned.

**`netlify/functions/run-product.mts`** — same real grounding for the paid,
owned version of the app.

**`netlify/lib/product-app.mts`** — adds a proper form for the owned app
(a "Client's website" URL field, business name, target city) instead of the
generic automations form, and the honesty-locked `SKU_RUN_BRIEF` entry that
tells Claude to treat the live scan as ground truth and never invent GBP/
competitor specifics.

**`catalog.mts` / `netlify/lib/catalog.mts`** — updated blurb and spec to
honestly say what's now true: the free demo actually scans a real page,
which no comparable listing on the site (or, as far as either of us knows,
any competitor's) can currently claim.

## One thing worth knowing

The migration file's price/blurb/spec lines changed again since the last
round — this patch updates the still-unrun migration in place rather than
adding a second one, since it was never applied yet. If you already ran the
earlier version of this migration against your live database, you'll need
to also run an `UPDATE products SET blurb = ..., spec = ... WHERE sku =
'AI-AB-071'` by hand (or just re-run this migration file's INSERT — it's
`ON CONFLICT DO NOTHING`, so it won't touch an existing row; check which
case you're in before assuming the new copy is live).

## Worth checking after it deploys

- Open the product, type a real URL into "try it on your own situation",
  and confirm the response references real findings from that page.
- Try a broken/unreachable URL and confirm it says the fetch failed rather
  than inventing findings.
- Try the owned-app version (if you can test as an owner) with the new
  "Client's website" field.
