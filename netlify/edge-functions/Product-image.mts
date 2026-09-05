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

// ---- "logo" template: Multi-branded connectors/agents get a polished,
// centered icon-and-wordmark treatment — a full-bleed accent gradient, the
// product's mark on a soft plate, the name below — instead of the generic
// prompt-pack card or a window-chrome screenshot mockup. These are real
// installable software, and the goal here is something that reads as an
// actual app icon/logo, not a UI screenshot or an ad creative.

// A two-stop gradient (lighter to deeper) plus one simple vector mark per
// Multi product, keyed by SKU so a rename doesn't silently fall back to the
// generic glyph. Marks render in white directly on the gradient (no
// separate colored badge) and are plain shapes/paths — no external icon
// assets, since resvg only rasterizes what's in the SVG itself.
const SOFTWARE_STYLE: Record<string, { gradient: [string, string]; mark: (color: string) => string }> = {
  // MultiWitness — a hash-chain: linked rounded rects.
  'AI-CN-006': {
    gradient: ['#FFC94D', '#D98E00'],
    mark: (c) => `<g fill="none" stroke="${c}" stroke-width="10">
      <rect x="-76" y="-22" width="78" height="44" rx="11"/>
      <rect x="-2" y="-22" width="78" height="44" rx="11"/>
    </g>`,
  },
  // MultiGuard — a shield.
  'AI-CN-007': {
    gradient: ['#FF7A7A', '#C21E1E'],
    mark: (c) => `<path d="M0 -80 L68 -54 L68 12 C68 58 34 82 0 94 C-34 82 -68 58 -68 12 L-68 -54 Z" fill="none" stroke="${c}" stroke-width="11"/>`,
  },
  // MultiVault — a padlock. Body is filled (not outlined) so the keyhole
  // cutout reads clearly against the white; the keyhole itself uses the
  // gradient's darker stop so it looks cut rather than just a same-color dot.
  'AI-CN-008': {
    gradient: ['#B79CFF', '#6B3FD4'],
    mark: (c) => `<g>
      <path d="M-38 -8 L-38 -36 C-38 -60 -21 -76 0 -76 C21 -76 38 -60 38 -36 L38 -8" fill="none" stroke="${c}" stroke-width="11"/>
      <rect x="-56" y="-8" width="112" height="84" rx="11" fill="${c}"/>
      <circle cx="0" cy="26" r="9" fill="#6B3FD4"/>
      <rect x="-4" y="30" width="8" height="20" fill="#6B3FD4"/>
    </g>`,
  },
  // MultiConnect: Zapier/Webhook Bridge — a lightning bolt.
  'AI-CN-001': {
    gradient: ['#FFA366', '#E0500A'],
    mark: (c) => `<path d="M13 -82 L-50 8 L-4 8 L-13 82 L50 -14 L4 -14 Z" fill="${c}"/>`,
  },
  // MultiConnect: Shopify — a shopping bag with two separated strap handles
  // (a single wide arc across the top reads as a bucket/trash-can, not a bag).
  'AI-CN-002': {
    gradient: ['#6FE0A0', '#0E9A52'],
    mark: (c) => `<g fill="none" stroke="${c}" stroke-width="9">
      <path d="M-48 -26 L48 -26 L40 74 L-40 74 Z" stroke-linejoin="round"/>
      <path d="M-26 -26 L-26 -46 C-26 -57 -15 -63 -8 -63" stroke-linecap="round"/>
      <path d="M26 -26 L26 -46 C26 -57 15 -63 8 -63" stroke-linecap="round"/>
    </g>`,
  },
  // MultiConnect: Sheets/Airtable — a grid.
  'AI-CN-003': {
    gradient: ['#5FE0D0', '#0B8F80'],
    mark: (c) => `<g fill="none" stroke="${c}" stroke-width="9">
      <rect x="-67" y="-67" width="134" height="134" rx="9"/>
      <line x1="-67" y1="-22" x2="67" y2="-22"/>
      <line x1="-67" y1="24" x2="67" y2="24"/>
      <line x1="-22" y1="-67" x2="-22" y2="67"/>
      <line x1="24" y1="-67" x2="24" y2="67"/>
    </g>`,
  },
  // MultiConnect: Email/CRM — an envelope.
  'AI-CN-004': {
    gradient: ['#7FB3FF', '#1655C9'],
    mark: (c) => `<g fill="none" stroke="${c}" stroke-width="10">
      <rect x="-70" y="-50" width="140" height="100" rx="9"/>
      <path d="M-70 -44 L0 8 L70 -44"/>
    </g>`,
  },
  // MultiConnect: Slack/Discord — a chat bubble.
  'AI-CN-005': {
    gradient: ['#9C9CFF', '#4636C9'],
    mark: (c) => `<path d="M-67 -52 L67 -52 C75 -52 80 -47 80 -39 L80 17 C80 25 75 30 67 30 L4 30 L-28 58 L-23 30 L-67 30 C-75 30 -80 25 -80 17 L-80 -39 C-80 -47 -75 -52 -67 -52 Z" fill="none" stroke="${c}" stroke-width="10"/>`,
  },
}

// A generic fallback for any future "Multi"-prefixed product not yet mapped
// above — a simple terminal-prompt mark on the site's own brass accent, so a
// new connector still gets the logo treatment on day one instead of erroring
// or reverting silently to the plain card.
const DEFAULT_SOFTWARE_STYLE = {
  gradient: ['#FFD37A', '#B37600'] as [string, string],
  mark: (c: string) => `<text x="0" y="20" font-family="JetBrains Mono" font-weight="700" font-size="72" fill="${c}" text-anchor="middle">&gt;_</text>`,
}

function isSoftwareProduct(p: ApiProduct): boolean {
  return p.category === 'connectors' || p.name.startsWith('Multi')
}

function buildSoftwareSvg(p: ApiProduct): string {
  const style = SOFTWARE_STYLE[p.sku] ?? DEFAULT_SOFTWARE_STYLE
  const [g1, g2] = style.gradient
  const gradId = `g-${p.sku.replace(/[^a-zA-Z0-9]/g, '')}`
  const cx = W / 2

  // Auto-size + wrap: short names ("MultiVault") stay big and single-line;
  // longer ones ("MultiConnect: Zapier/Webhook Bridge") shrink and wrap onto
  // 2 lines rather than overflowing the canvas edge, which a fixed single-line
  // size did for anything past ~24 characters.
  const longName = p.name.length > 20
  const nameSize = longName ? 46 : 64
  const nameLines = longName ? wrapTitle(p.name, 26) : [p.name]
  const lineHeight = nameSize * 1.15
  const iconCy = nameLines.length > 1 ? H / 2 - 108 : H / 2 - 78
  const nameBlockTop = H - 128 - (nameLines.length - 1) * lineHeight
  const nameTspans = nameLines
    .map((line, i) => `<tspan x="${cx}" y="${nameBlockTop + i * lineHeight}">${esc(line)}</tspan>`)
    .join('')

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="100%" stop-color="${g2}"/>
    </linearGradient>
    <radialGradient id="${gradId}-glow" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${gradId})"/>
  <rect width="${W}" height="${H}" fill="url(#${gradId}-glow)"/>

  <circle cx="${cx}" cy="${iconCy}" r="118" fill="#FFFFFF" fill-opacity="0.12"/>
  <g transform="translate(${cx}, ${iconCy})">
    ${style.mark('#FFFFFF')}
  </g>

  <text font-family="Inter" font-weight="700" font-size="${nameSize}" fill="#FFFFFF" text-anchor="middle">${nameTspans}</text>

  <text x="60" y="${H - 46}" font-family="Inter" font-weight="700" font-size="19" letter-spacing="3" fill="#FFFFFF" fill-opacity="0.7">${esc(STORE)}</text>
  <text x="${W - 60}" y="${H - 46}" font-family="JetBrains Mono" font-size="17" fill="#FFFFFF" fill-opacity="0.55" text-anchor="end">${esc(p.sku)}</text>
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
