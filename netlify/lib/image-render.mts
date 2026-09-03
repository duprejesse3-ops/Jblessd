// Server-side SVG -> PNG rasterization.
//
// ad-image.mts already builds a polished, on-brand SVG creative per product
// (or the whole store), but its rasterization step lives in the BROWSER
// (admin.html's <canvas> — see ad-image.mts's own comment on that). A
// scheduled function has no browser/canvas available, so posting a real
// image from x-poster.mts / bluesky-poster.mts needs a real server-side
// rasterizer instead.
//
// @resvg/resvg-js is a WASM/native SVG renderer with no system dependencies
// (unlike the rsvg-convert CLI the local icon-build scripts use) — it works
// as a plain npm dependency inside a Netlify function.

import { Resvg } from '@resvg/resvg-js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// resvg-js needs real font files to draw any text — Netlify's function
// runtime is a minimal container with NO system fonts installed, unlike a
// local dev machine or the build environment the local icon-build scripts
// (icons/build-*.mjs) run in. Without this, text elements in the SVG
// (product names, prices, CTA labels) silently render as nothing while
// vector paths (icons, backgrounds, buttons) still draw fine — that
// mismatch is exactly what showed up as "blank" areas on posted images.
//
// Fonts are bundled directly in netlify/lib/fonts/ rather than depended on
// from the host, and loadSystemFonts is turned off so behavior doesn't vary
// based on what happens to be installed wherever this runs. netlify.toml's
// [functions] included_files entry is what makes sure these .ttf files
// actually ship with the deployed function — esbuild's default bundling
// only picks up JS/TS, not binary assets like fonts.
//
// Path resolution deliberately does NOT use import.meta.url / dirname(this
// file) — once esbuild bundles this module into each function's output,
// import.meta.url reflects the BUNDLED file's location, not this source
// file's original location, so a path built from it silently points
// somewhere wrong. included_files are unpacked preserving their repo-root-
// relative path under the Lambda runtime's task root, which Netlify exposes
// as LAMBDA_TASK_ROOT — that's the one path base guaranteed to line up with
// how included_files was declared in netlify.toml.
const TASK_ROOT = process.env.LAMBDA_TASK_ROOT || process.cwd()
const FONTS_DIR = join(TASK_ROOT, 'netlify', 'lib', 'fonts')
const FONT_FILES = [
  join(FONTS_DIR, 'DejaVuSans.ttf'),
  join(FONTS_DIR, 'DejaVuSans-Bold.ttf'),
  join(FONTS_DIR, 'DejaVuSansMono.ttf'),
  join(FONTS_DIR, 'DejaVuSansMono-Bold.ttf'),
]

// A wrong font path does NOT throw — resvg-js just silently renders no text
// for that family, which is indistinguishable from "working" until someone
// notices blank text on a live post. Checking existence up front and logging
// loudly turns that into a visible, diagnosable error instead.
let fontsChecked = false
function verifyFontsOnce(): void {
  if (fontsChecked) return
  fontsChecked = true
  const missing = FONT_FILES.filter((f) => !existsSync(f))
  if (missing.length) {
    console.error(
      `[image-render] font file(s) not found at expected path — text will render blank: ${missing.join(', ')}. ` +
        `TASK_ROOT resolved to: ${TASK_ROOT}. Check netlify.toml's [functions] included_files entry.`
    )
  }
}

/**
 * Fetch the existing ad-image creative for a product (or the whole store,
 * when sku is empty) and rasterize it to a PNG buffer at its native size.
 * Reuses ad-image.mts's already-correct, catalog-grounded SVG instead of
 * duplicating any creative-building logic here.
 */
export async function fetchCreativePng(
  siteOrigin: string,
  sku: string | null,
  size: 'landscape' | 'square' | 'portrait' = 'square',
  variant: 0 | 1 | 2 = 0
): Promise<Buffer> {
  verifyFontsOnce()

  const params = new URLSearchParams({ size, variant: String(variant) })
  if (sku) params.set('sku', sku)

  const res = await fetch(`${siteOrigin}/api/ad-image?${params.toString()}`)
  if (!res.ok) throw new Error(`ad-image fetch failed: ${res.status}`)
  const svg = await res.text()

  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: FONT_FILES,
      // ad-image.mts's SVG uses the generic CSS families "sans-serif" and
      // "monospace" — these map those generic names to the real bundled
      // fonts above, matching the DejaVu Sans Mono look the local
      // icons/build-og.mjs script already uses for brand consistency.
      sansSerifFamily: 'DejaVu Sans',
      monospaceFamily: 'DejaVu Sans Mono',
    },
  })
  const rendered = resvg.render()
  return rendered.asPng()
}
