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

const SITE = 'https://multinicheai.com'
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

let monoFontCache: Uint8Array | null = null
async function getMonoFont(): Promise<Uint8Array> {
  if (monoFontCache) return monoFontCache
  // JetBrains Mono, matching the site's own monospace font (pages.ts <style>
  // uses it for .sku/nav.crumbs). Loaded separately from Inter above —
  // resvg-wasm has no system fonts, so a font-family referenced in an SVG
  // but never passed in fontBuffers renders as missing glyphs, not a
  // fallback. Needed here because the software template's command-line-style
  // text (the "$ vault --help" line, the window titlebar) is meant to
  // actually look like a terminal, not just claim to.
  const res = await fetch(
    'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf/JetBrainsMono-Bold.ttf',
  )
  monoFontCache = new Uint8Array(await res.arrayBuffer())
  return monoFontCache
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

// Wraps a title into at most 3 lines by word count, roughly matching the SVG's
// available width at this font size — good enough for product names in this
// catalog, which run short (2-6 words).
function wrapTitle(name: string, maxLineChars = 22): string[] {
  const words = name.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (candidate.length > maxLineChars && line) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

// ---- "software" template: Multi-branded connectors/agents get an app-icon
// look (window chrome, a mark, a command-line hint) instead of the generic
// prompt-pack card, since these are real installable software, not documents.

// One accent color and one simple vector mark per Multi product, keyed by
// SKU so a rename doesn't silently fall back to the generic glyph. Marks are
// plain shapes/paths (no external icon assets) since resvg only rasterizes
// what's in the SVG itself.
const SOFTWARE_STYLE: Record<string, { accent: string; mark: string }> = {
  // MultiWitness — a hash-chain: linked rounded rects.
  'AI-CN-006': {
    accent: '#FFB020',
    mark: `<g>
      <rect x="-58" y="-16" width="60" height="32" rx="8" fill="none" stroke="#0A0E16" stroke-width="7"/>
      <rect x="-2" y="-16" width="60" height="32" rx="8" fill="none" stroke="#0A0E16" stroke-width="7"/>
    </g>`,
  },
  // MultiGuard — a shield.
  'AI-CN-007': {
    accent: '#FF4D4D',
    mark: `<path d="M0 -60 L52 -40 L52 8 C52 44 26 62 0 72 C-26 62 -52 44 -52 8 L-52 -40 Z" fill="none" stroke="#0A0E16" stroke-width="8"/>`,
  },
  // MultiVault — a padlock.
  'AI-CN-008': {
    accent: '#8B5CF6',
    mark: `<g>
      <path d="M-30 -6 L-30 -28 C-30 -46 -16 -60 0 -60 C16 -60 30 -46 30 -28 L30 -6" fill="none" stroke="#0A0E16" stroke-width="8"/>
      <rect x="-44" y="-6" width="88" height="66" rx="8" fill="#0A0E16"/>
      <circle cx="0" cy="20" r="8" fill="${'#8B5CF6'}"/>
      <rect x="-4" y="24" width="8" height="18" fill="${'#8B5CF6'}"/>
    </g>`,
  },
  // MultiConnect: Zapier/Webhook Bridge — a lightning bolt.
  'AI-CN-001': {
    accent: '#FF7A45',
    mark: `<path d="M10 -62 L-38 6 L-4 6 L-10 62 L38 -10 L4 -10 Z" fill="#0A0E16"/>`,
  },
  // MultiConnect: Shopify — a shopping bag with two separated strap handles
  // (a single wide arc across the top reads as a bucket/trash-can, not a bag).
  'AI-CN-002': {
    accent: '#22C55E',
    mark: `<g fill="none" stroke="#0A0E16" stroke-width="7">
      <path d="M-38 -20 L38 -20 L32 56 L-32 56 Z" stroke-linejoin="round"/>
      <path d="M-20 -20 L-20 -36 C-20 -44 -12 -48 -6 -48" stroke-linecap="round"/>
      <path d="M20 -20 L20 -36 C20 -44 12 -48 6 -48" stroke-linecap="round"/>
    </g>`,
  },
  // MultiConnect: Sheets/Airtable — a grid.
  'AI-CN-003': {
    accent: '#14B8A6',
    mark: `<g fill="none" stroke="#0A0E16" stroke-width="7">
      <rect x="-52" y="-52" width="104" height="104" rx="6"/>
      <line x1="-52" y1="-17" x2="52" y2="-17"/>
      <line x1="-52" y1="18" x2="52" y2="18"/>
      <line x1="-17" y1="-52" x2="-17" y2="52"/>
      <line x1="18" y1="-52" x2="18" y2="52"/>
    </g>`,
  },
  // MultiConnect: Email/CRM — an envelope.
  'AI-CN-004': {
    accent: '#3B82F6',
    mark: `<g fill="none" stroke="#0A0E16" stroke-width="8">
      <rect x="-54" y="-38" width="108" height="76" rx="6"/>
      <path d="M-54 -34 L0 6 L54 -34"/>
    </g>`,
  },
  // MultiConnect: Slack/Discord — a chat bubble.
  'AI-CN-005': {
    accent: '#6366F1',
    mark: `<path d="M-52 -40 L52 -40 C58 -40 62 -36 62 -30 L62 14 C62 20 58 24 52 24 L4 24 L-22 46 L-18 24 L-52 24 C-58 24 -62 20 -62 14 L-62 -30 C-62 -36 -58 -40 -52 -40 Z" fill="none" stroke="#0A0E16" stroke-width="8"/>`,
  },
}

// A generic fallback mark for any future "Multi"-prefixed product not yet
// mapped above — a simple terminal prompt, so a new connector still gets the
// software treatment on day one instead of erroring or reverting silently to
// the plain card.
const DEFAULT_SOFTWARE_MARK = `<text x="0" y="20" font-family="JetBrains Mono" font-weight="700" font-size="56" fill="#0A0E16" text-anchor="middle">&gt;_</text>`

function isSoftwareProduct(p: ApiProduct): boolean {
  return p.category === 'connectors' || p.name.startsWith('Multi')
}

function buildSoftwareSvg(p: ApiProduct): string {
  const style = SOFTWARE_STYLE[p.sku] ?? { accent: '#FFB020', mark: DEFAULT_SOFTWARE_MARK }
  const cat = p.catLabel ?? CATEGORY_LABEL[p.category] ?? p.category
  const cmdName = p.name.split(':').pop()!.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  // Title column starts at x=340 with ~30px right margin, so ~830px available.
  // Long names ("MultiConnect: Zapier/Webhook Bridge") overflow that at the
  // single-line 52px size used for short ones ("MultiVault") — shrink and
  // wrap onto a second line rather than letting it run off the canvas edge.
  const longName = p.name.length > 24
  const titleSize = longName ? 40 : 52
  const titleLines = longName ? wrapTitle(p.name, 24) : [p.name]
  const titleLineHeight = titleSize + 12
  const titleStartY = 250
  const titleTspans = titleLines
    .map((line, i) => `<tspan x="340" y="${titleStartY + i * titleLineHeight}">${esc(line)}</tspan>`)
    .join('')
  const cmdY = titleStartY + titleLines.length * titleLineHeight + 16

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0A0E16"/>

  <!-- window chrome -->
  <rect x="0" y="0" width="${W}" height="56" fill="#121826"/>
  <rect x="0" y="56" width="${W}" height="1" fill="#232B3D"/>
  <circle cx="34" cy="28" r="9" fill="#FF5F57"/>
  <circle cx="62" cy="28" r="9" fill="#FEBC2E"/>
  <circle cx="90" cy="28" r="9" fill="#28C840"/>
  <text x="${W / 2}" y="35" font-family="JetBrains Mono" font-size="17" fill="#5C6580" text-anchor="middle">${esc(cmdName)} — ${esc(cat)}</text>
  <text x="${W - 32}" y="35" font-family="Inter" font-weight="700" font-size="15" letter-spacing="2" fill="#5C6580" text-anchor="end">${esc(STORE)}</text>

  <!-- app icon -->
  <g transform="translate(180, 300)">
    <rect x="-100" y="-100" width="200" height="200" rx="44" fill="${style.accent}"/>
    ${style.mark}
  </g>

  <!-- title + price -->
  <text font-family="Inter" font-weight="700" font-size="${titleSize}" fill="#EEF1F7">${titleTspans}</text>
  <text x="340" y="${cmdY}" font-family="JetBrains Mono" font-size="20" fill="${style.accent}">$ ${esc(cmdName)} --help</text>
  <text x="340" y="560" font-family="Inter" font-weight="700" font-size="44" fill="#EEF1F7">$${Number(p.price).toFixed(2)}</text>
  <text x="1120" y="560" font-family="Inter" font-weight="500" font-size="20" fill="#5C6580" text-anchor="end">Real source. Zero dependencies.</text>
</svg>`.trim()
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
  <rect width="${W}" height="${H}" fill="#0A0E16"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#FFB020"/>
  <text x="80" y="90" font-family="Inter" font-weight="700" font-size="28" letter-spacing="3" fill="#FFB020">${esc(STORE)}</text>
  <rect x="80" y="130" width="${Math.max(cat.length * 13 + 40, 120)}" height="42" rx="3" fill="#FFB020"/>
  <text x="${80 + Math.max(cat.length * 13 + 40, 120) / 2}" y="158" font-family="Inter" font-weight="700" font-size="18" letter-spacing="2" fill="#0A0E16" text-anchor="middle">${esc(cat.toUpperCase())}</text>
  <text font-family="Inter" font-weight="700" font-size="54" fill="#EEF1F7">${titleTspans}</text>
  <text x="80" y="560" font-family="Inter" font-weight="700" font-size="44" fill="#EEF1F7">$${Number(p.price).toFixed(2)}</text>
  <text x="1120" y="560" font-family="Inter" font-weight="500" font-size="20" fill="#5C6580" text-anchor="end">Watch it run before you buy →</text>
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
    const isSoftware = isSoftwareProduct(product)
    const svg = isSoftware ? buildSoftwareSvg(product) : buildSvg(product)
    const fontBuffers = isSoftware ? [font, await getMonoFont()] : [font]
    const resvg = new Resvg(svg, {
      font: { fontBuffers, defaultFontFamily: 'Inter' },
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
