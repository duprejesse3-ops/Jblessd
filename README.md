# SEO Agency Blueprint: real default demo + a product that fixes, not just finds

Base commit: `706dfcc` (current `main`). One patch, 4 files, ~605 lines.

## Apply

```
git apply seo-fix-engine.patch
```
(run from your repo root; verified to apply clean against current `main`)

Nothing else needed — no new dependencies, no migration, no env var. The
existing `SEED_DATA`/catalog entry for AI-AB-071 doesn't change; this patch
only touches how the demo and paid "run it as an app" flow behave.

## What changed and why

**1. The default (no-scenario) "Live Proof" demo now runs a real scan too.**

Before: only a shopper's own submitted scenario triggered the real live
fetch-and-parse of a page (`netlify/lib/seo-live-context.mts`). The default
demo — the one that's cached and shown to every visitor who just clicks
"Live Proof" without typing anything — still had Claude invent a plausible
run with no real data behind it. That's the gap you flagged with the
screenshots: it was reporting things about your own site that weren't true.

Now: the default demo scans `https://multinicheai.com` itself, for real,
every time the cache is rebuilt. A shopper's own scenario still scans their
own page instead. Either way, the demo is grounded in an actual fetch —
never an invented one.

**2. The product now generates fixes, not just an audit — and it can't
hallucinate them.**

This is the bigger change. `seo-live-context.mts` gained a second function,
`buildFixPack()`, that is **pure code — no model call**. Given the real
findings from the scan (title, meta description, canonical, schema, etc.)
plus whatever the buyer typed (business name, city, category — the app form
now asks for all three), it deterministically generates:

- A corrected `<title>` tag, when the current one is missing/too short/too
  long
- A corrected meta description, same logic
- A missing canonical tag
- A `LocalBusiness` JSON-LD block — **only** when a real business name AND
  city were given; otherwise it explains plainly why it's skipping rather
  than inventing an identity
- A sitemap line for `robots.txt`, when one's missing

Every value in the output is either something the scan actually found,
something the buyer actually typed, or an explicit `[ADD: ...]` bracketed
placeholder — never a plausible guess. If a page is already healthy, the fix
pack says so; that's a real result too, not a failure to produce something.

Claude's job in the prompt is now to *present* this generated fix pack
faithfully and explain it in plain language — not to write the fixes itself.
That's the actual mechanism that makes this reliable: the code that finds
the problem is also the code that writes the fix, with no model step in
between where a plausible-sounding wrong answer could sneak in.

**3. The scanner itself got more honest about failure.**

Previously a failed fetch returned one generic "scan failed" string no
matter why. Now it retries once (only on a genuine network error — DNS,
timeout, connection reset; a real HTTP response, even an error one, isn't
retried since retrying it changes nothing) and reports *why* it failed:
blocked (403/429 — the site is up but refusing automated requests), not
found (404), the target server erroring (5xx), or genuinely unreachable.
The prompt tells Claude to say the specific reason rather than a vague
"couldn't scan it."

**4. Files touched**

- `netlify/lib/seo-live-context.mts` — rewritten: retry + honest failure
  classification, plus the new `runSeoAudit()` (returns structured findings)
  and `buildFixPack()`. `fetchSeoLiveContext()` is kept as a thin wrapper so
  nothing else breaks if it's referenced elsewhere.
- `netlify/functions/demo.mts` — default demo now always scans for real;
  wires the fix pack into the prompt when a scan succeeds.
- `netlify/functions/run-product.mts` — paid "run it as an app" flow now
  passes the buyer's business name/city/category into `buildFixPack`.
- `netlify/lib/product-app.mts` — added a `category` field to the app form;
  extended the SKU's run-brief with a "fix-pack lock" rule so Claude
  reproduces the generated code faithfully instead of rewriting it; passed
  the fix pack through `buildRunPrompt`.

## Verified before sending

- `tsc --noEmit` clean on all 4 files (only pre-existing, unrelated errors
  remain — a `host` product category missing from a few `Record<>` types
  elsewhere in the repo that I didn't touch; confirmed identical on an
  untouched clone, so not something this patch introduced).
- Compiled with esbuild and actually **ran** the code (not just type-checked
  it): real live fetches against `github.com`, a real 404, a real
  unreachable-domain retry-timing check, the "already healthy, nothing to
  fix" path against your site's real previously-confirmed title/meta/schema
  values, and the "only businessName given, no city" honest-skip path.
- `JSON.parse()`'d the generated `LocalBusiness` schema block to confirm
  it's actually valid JSON-LD, not just a string that looks right.
- Ran `buildRunPrompt`/`buildProductApp` end to end with a real scan feeding
  a real fix pack, and confirmed the generated prompt text actually contains
  both the Live scan and Fix pack sections in the right shape.
- Applied this exact patch to a second, independent fresh clone of your
  current `main` and confirmed it applies with zero conflicts.

One thing I could **not** verify from here: an actual fetch of
`multinicheai.com` itself timed out in this sandbox — but that's this
sandbox's own outbound network allowlist blocking the request before it
leaves (confirmed: the identical request against `github.com` went through
fine, and even a plain `curl` to your domain hits the same sandbox-level
block). Netlify's own servers won't have that restriction. Worth watching
the first live default-demo rebuild after deploy to confirm the scan
actually succeeds against your real site rather than hitting a WAF/bot
block on your end — if it does get blocked, the honest "blocked, not
missing" message will say so plainly rather than showing a false finding,
which was the whole point of this fix.

## One thing to decide

The default demo now does a real network fetch of your own homepage on
every cache rebuild (still cached in Blobs after that — cheap, not per
visitor). If you'd rather it never re-fetches until you explicitly bump
`CACHE_VERSION` in `demo.mts`, that's already how it behaves — nothing
extra needed.
