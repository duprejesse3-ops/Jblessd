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

  const resvg = new Resvg(svg)
  const rendered = resvg.render()
  return rendered.asPng()
}
