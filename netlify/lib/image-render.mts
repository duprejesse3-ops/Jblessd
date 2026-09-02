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
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// resvg-js needs real font files to draw any text — Netlify's function
// runtime is a minimal container with NO system fonts installed, unlike a
// local dev machine or the build environment the local icon-build scripts
// (icons/build-*.mjs) run in. Without this, text elements in the SVG
// (product names, prices, CTA labels) silently render as nothing while
// vector paths (icons, backgrounds, buttons) still draw fine — that
// mismatch is exactly what showed up as "blank" areas on posted images.
//
// Fonts are bundled directly in this directory (netlify/lib/fonts/) rather
// than depended on from the host, and loadSystemFonts is turned off so
// behavior doesn't vary based on what happens to be installed wherever this
// runs. netlify.toml's [functions] included_files entry is what makes sure
// these .ttf files actually ship with the deployed function — esbuild's
// default bundling only picks up JS/TS, not binary assets like fonts.
const FONTS_DIR = dirname(fileURLToPath(import.meta.url)) + '/fonts'
const FONT_FILES = [
  join(FONTS_DIR, 'DejaVuSans.ttf'),
  join(FONTS_DIR, 'DejaVuSans-Bold.ttf'),
  join(FONTS_DIR, 'DejaVuSansMono.ttf'),
  join(FONTS_DIR, 'DejaVuSansMono-Bold.ttf'),
]

/**
 * Fetch the existing ad-image creative for a product (or the whole store,
 * when sku is empty) and rasterize it to a PNG buffer at its native size.
 * Reuses ad-image.mts's already-correct, catalog-grounded SVG instead of
 * duplicating any creative-building logic here.
 */
export async function fetchCreativePng(
  siteOrigin: string,
  sku: string | null,
  size: 'landscape' | 'square' | 'portrait' = 'square'
): Promise<Buffer> {
  const params = new URLSearchParams({ size })
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
