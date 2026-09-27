# Hey Term — files to add to your repo

I don't have GitHub write access in this session, so I couldn't commit
these directly. Here's exactly what to do with this folder.

## New files — copy these in as-is

- `packages/hey-term/` (whole folder) — the real, runnable product source:
  Python app, tests (73, all passing), README, LICENSE, the two setup
  scripts, and `install.sh` / `install.ps1` entry points.
- `netlify/lib/hey-term-source.mts` — the generated embed of that source
  (same pattern as `netlify/lib/multiguard-source.mts` etc.). Regenerate it
  any time you change the package with:
  ```
  node packages/hey-term/tools/embed-source.mjs
  ```
- `netlify/database/migrations/20260927130000_add_hey_term_product/migration.sql`
  — adds the catalog row (SKU `AI-AG-130`, category `agents`, niche
  `developers`, $69). Roll-forward only, `ON CONFLICT (sku) DO NOTHING`, so
  it's safe to apply even if run twice.

## Modified files — these replace your existing copies

- `netlify/lib/product-archive.mts` — added the Hey Term import, its
  executable-file set, its root folder name, a `heyTermFiles()` function,
  and one line in the `ARCHIVES` map (`'AI-AG-130': { filename:
  'hey-term.zip', files: heyTermFiles }`). Everything else in the file is
  untouched — diff it against your current copy before overwriting if you
  want to double check.
- `catalog.mts` — added one row to `FALLBACK_CATALOG` (the DB-unreachable
  fallback list) for `AI-AG-130`, following the same shape as every other
  entry. Also untouched otherwise.
- `netlify/edge-functions/Product-image.mts` — added a real, custom product
  image instead of letting Hey Term fall back to the generic "agents"
  category stock photo. Three small edits, same pattern as every existing
  `SOFTWARE_STYLE` entry (MultiGuard's shield, MultiVault's padlock, etc.):
  a `SOFTWARE_STYLE['AI-AG-130']` entry (a microphone-with-soundwaves mark,
  magenta/violet gradient — not reused from any existing product), one line
  in `photoStyleFor()` so it doesn't get overridden by the category photo,
  and one clause in `isSoftwareProduct()` so it gets the logo/wordmark
  treatment (Hey Term doesn't carry the "Multi" prefix that normally
  triggers this automatically). No static image files needed — this
  renders live at request time, same as every other vector-icon product.
  Rendered a local, byte-faithful preview of the exact same SVG-building
  logic (see attached PNGs) to confirm it actually looks right before
  handing this back — not just written blind.

## What I verified before handing this back

- All 73 of Hey Term's own tests pass from inside `packages/hey-term/`.
- `netlify/lib/hey-term-source.mts` round-trips byte-for-byte against the
  real package files (checked programmatically, not just visually).
- `netlify/lib/product-archive.mts` and `catalog.mts` both type-check
  clean with `tsc --noEmit` (only pre-existing sibling-import resolution
  quirks show up, same as your other `-source.mts` files — nothing from my
  edit).
- SKU `AI-AG-130` is genuinely the next unused `AI-AG-` number — checked
  against every SKU already used in the repo's `.sql` files.
- `Product-image.mts` type-checks clean with `tsc --noEmit`, and I rendered
  the actual card-grid banner (1200x160) and full (1200x630) images locally
  using the exact same SVG-building logic (a copy of `buildThumbSvg` /
  `buildSoftwareSvg`, gradient and mark included) to see the real output
  before sending it — not a guess at how it'd look. The live site will use
  Inter/JetBrains Mono for the text; my local preview fell back to a system
  font since I don't have those fonts here, so the live version's type will
  look slightly cleaner than the preview PNGs, but the layout, icon, and
  colors are exactly what will render.

## What I could NOT verify (be aware before you deploy)

- I did not run your actual build/deploy pipeline (Netlify, the DB
  migration runner, `zip.mts`'s real zip-building) against these changes —
  no live Netlify environment here. The static shape matches every other
  product exactly, but a real deploy is the first time this gets tested
  end-to-end.
- `packages/hey-term/scripts/setup-windows.ps1` (and by extension
  `install.ps1`) has never been run on an actual Windows machine — no
  PowerShell interpreter in this sandbox. Written carefully, mirrors the
  Linux script's logic, but flag it if a buyer reports an issue.

## One thing worth deciding, not assumed

Every other package's LICENSE/install-script header in this repo uses a
literal `[SELLER]` placeholder (e.g. `packages/multiguard/LICENSE.md`).
Hey Term's says "MultiNiche AI" instead, since that's what you originally
asked for when we built it. If you'd rather it match the `[SELLER]`
convention the rest of the catalog uses, that's a one-line find/replace in
`packages/hey-term/LICENSE.md`, `install.sh`, and `install.ps1` — just say
the word.
