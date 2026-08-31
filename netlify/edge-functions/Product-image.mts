// Edge function: generates a unique, on-brand PNG image per product on the fly.
//
// Product/homepage structured data (seo.ts, pages.ts) previously pointed every
// single product at the same generic site OG image, which keeps all 66 SKUs
// visually identical in Google Images and rich results. This renders a real,
// distinct raster image per SKU — required because Schema.org Product images
// must be PNG/JPG/WebP, not SVG — built as an SVG card (name, category, price,
// brand) and rasterized with resvg.
//
// Reached at /product-image/:sku.png — seo.ts and pages.ts should point their
// `image` fields here instead of the static OG image.

import type { Context, Config } from '@netlify/edge-functions'
import { Resvg, initWasm } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2'

const SITE = 'https://jblessd.com'
const STORE = 'MULTINICHE AI'
const W = 1200
const H = 630

const CATEGORY_LABEL: Record<string, string> = {
  prompts: 'Prompt Packs',
  automations: 'Automation Blueprints',
  templates: 'Doc Templates',
  agents: 'Agent Configs',
  connectors: 'Connectors',
}

interface ApiProduct {
  sku: string
  name: string
  category: string
  price: number
  catLabel?: string
}

let wasmReady: Promise<void> | null = null
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = fetch('https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm')
      .then((r) => r.arrayBuffer())
      .then((buf) => initWasm(buf))
  }
  return wasmReady
}

let fontCache: Uint8Array | null = null
async function getFont(): Promise<Uint8Array> {
  if (fontCache) return fontCache
  // Inter, matching the site's body font (pages.ts <style>).
  const res = await fetch(
    'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Bold.woff2',
  )
  fontCache = new Uint8Array(await res.arrayBuffer())
  return fontCache
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

// Wraps a title into at most 3 lines by word count, roughly matching the SVG's
// available width at this font size — good enough for product names in this
// catalog, which run short (2-6 words).
function wrapTitle(name: string): string[] {
  const words = name.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (candidate.length > 22 && line) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function buildSvg(p: ApiProduct): string {
  const cat = p.catLabel ?? CATEGORY_LABEL[p.category] ?? p.category
  const lines = wrapTitle(p.name)
  const titleY = 260
  const lineHeight = 64

  const titleTspans = lines
    .map((line, i) => `<tspan x="80" y="${titleY + i * lineHeight}">${esc(line)}</tspan>`)
    .join('')

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#080000"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#FF2A2A"/>
  <text x="80" y="90" font-family="Inter" font-weight="700" font-size="28" letter-spacing="3" fill="#FF2A2A">${esc(STORE)}</text>
  <rect x="80" y="130" width="${Math.max(cat.length * 13 + 40, 120)}" height="42" rx="3" fill="#FF2A2A"/>
  <text x="${80 + Math.max(cat.length * 13 + 40, 120) / 2}" y="158" font-family="Inter" font-weight="700" font-size="18" letter-spacing="2" fill="#080000" text-anchor="middle">${esc(cat.toUpperCase())}</text>
  <text font-family="Inter" font-weight="700" font-size="54" fill="#FFD4D4">${titleTspans}</text>
  <text x="80" y="560" font-family="Inter" font-weight="700" font-size="44" fill="#FFD4D4">$${Number(p.price).toFixed(2)}</text>
  <text x="1120" y="560" font-family="Inter" font-weight="500" font-size="20" fill="#9A3C3C" text-anchor="end">Watch it run before you buy →</text>
</svg>`.trim()
}

export default async (req: Request, _context: Context) => {
  const { pathname } = new URL(req.url)
  const match = pathname.match(/^\/product-image\/(.+)\.png$/)
  if (!match) return new Response('Not found', { status: 404 })
  const sku = decodeURIComponent(match[1])

  try {
    const apiRes = await fetch(new URL('/api/products', req.url), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    })
    if (!apiRes.ok) throw new Error('catalog fetch failed')
    const data = (await apiRes.json()) as { products?: ApiProduct[] }
    const product = data.products?.find((p) => p.sku === sku)
    if (!product) return new Response('Not found', { status: 404 })

    await ensureWasm()
    const font = await getFont()
    const svg = buildSvg(product)
    const resvg = new Resvg(svg, {
      font: { fontBuffers: [font], defaultFontFamily: 'Inter' },
      fitTo: { mode: 'width', value: W },
    })
    const png = resvg.render().asPng()

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800, durable',
      },
    })
  } catch (err) {
    console.error('product-image edge function:', (err as Error).message)
    return new Response('Image generation failed', { status: 500 })
  }
}

export const config: Config = {
  path: '/product-image/*',
}
