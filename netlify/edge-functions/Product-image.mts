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

function bufferToBase64(buf: ArrayBuffer): string {
  // btoa(String.fromCharCode(...bytes)) blows the call stack on a large
  // enough buffer since spread turns every byte into its own function
  // argument — chunking keeps this safe regardless of image size.
  const bytes = new Uint8Array(buf)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// Per-SKU real photography, embedded in place of the flat-gradient +
// vector-icon treatment every other software product gets — see the
// SOFTWARE_STYLE map above. Two derivatives per entry because the same
// source photo serves two very different aspect ratios (the short
// thumbnail banner vs. the full 1200x630 social/Schema.org image) — see
// PRODUCT_PHOTOS_README below for how these were made if a future product
// needs its own.
//
// PRODUCT_PHOTOS_README: both files are pre-cropped to their target aspect
// ratio (not left to a generic center-crop) so the photo's actual subject —
// the vault's dial, the stamp's press, the clock's face — stays in frame.
// If you add another photo-backed SKU, crop deliberately around whatever
// the product's most recognizable visual detail is, AND make sure that
// detail sits near the horizontal center of the 1200-wide banner source —
// object-fit:cover always crops symmetrically from the exact middle
// outward, so anything off-center gets cropped first, before the frame
// shrinks toward whatever IS centered. The first version of the MultiVault
// photo (and, in this batch, the first crop of the Deep Work Prompt Pack
// clock) got this wrong by centering the *photo's own* interesting content
// within itself rather than within the eventual 1200-wide banner — measure
// the actual pixel position of the detail in the final banner crop, not
// just "does this look nice as a standalone photo."
const PHOTO_STYLE: Record<string, { banner: string; full: string }> = {
  'AI-CN-008': { banner: '/icons/multivault-vault-banner.jpg', full: '/icons/multivault-vault-full.jpg' },
  'AI-CN-006': { banner: '/icons/products/AI-CN-006-banner.jpg', full: '/icons/products/AI-CN-006-full.jpg' },
  'AI-CN-007': { banner: '/icons/products/AI-CN-007-banner.jpg', full: '/icons/products/AI-CN-007-full.jpg' },
  'AI-PP-001': { banner: '/icons/products/AI-PP-001-banner.jpg', full: '/icons/products/AI-PP-001-full.jpg' },
  'AI-AB-002': { banner: '/icons/products/AI-AB-002-banner.jpg', full: '/icons/products/AI-AB-002-full.jpg' },
  'AI-AG-003': { banner: '/icons/products/AI-AG-003-banner.jpg', full: '/icons/products/AI-AG-003-full.jpg' },
  'AI-AG-015': { banner: '/icons/products/AI-AG-015-banner.jpg', full: '/icons/products/AI-AG-015-full.jpg' },
  'AI-AG-094': { banner: '/icons/products/AI-AG-094-banner.jpg', full: '/icons/products/AI-AG-094-full.jpg' },
}

const CATEGORY_PHOTO_STYLE: Record<string, { banner: string; full: string }> = {
  prompts: { banner: '/icons/products/cat-prompts-banner.jpg', full: '/icons/products/cat-prompts-full.jpg' },
  automations: { banner: '/icons/products/cat-automations-banner.jpg', full: '/icons/products/cat-automations-full.jpg' },
  templates: { banner: '/icons/products/cat-templates-banner.jpg', full: '/icons/products/cat-templates-full.jpg' },
  agents: { banner: '/icons/products/cat-agents-banner.jpg', full: '/icons/products/cat-agents-full.jpg' },
  connectors: { banner: '/icons/products/cat-connectors-banner.jpg', full: '/icons/products/cat-connectors-full.jpg' },
}

function photoStyleFor(p: ApiProduct): { banner: string; full: string } | undefined {
  if (PHOTO_STYLE[p.sku]) return PHOTO_STYLE[p.sku]
  // Six connectors (AI-CN-001 through 005, 009) already have their own
  // distinct vector icon in SOFTWARE_STYLE — a lightning bolt, a shopping
  // bag, a grid, an envelope, a chat bubble, a document. Falling back to
  // the shared "connectors" category photo for these would make all six
  // look identical in the card grid instead of instantly telling apart —
  // a real loss of distinctiveness, not a neutral substitution. The
  // category photo fallback is a strict upgrade for every OTHER category
  // (prompts/automations/templates/agents never had per-SKU art at all,
  // just a generic procedural pattern), so it only steps aside here.
  if (p.category === 'connectors' && SOFTWARE_STYLE[p.sku]) return undefined
  return CATEGORY_PHOTO_STYLE[p.category]
}

const photoCache = new Map<string, string>()
async function getPhotoDataUri(origin: string, path: string): Promise<string> {
  const cached = photoCache.get(path)
  if (cached) return cached
  const res = await fetch(new URL(path, origin))
  if (!res.ok) throw new Error(`Could not load product photo ${path} (${res.status})`)
  const dataUri = `data:image/jpeg;base64,${bufferToBase64(await res.arrayBuffer())}`
  photoCache.set(path, dataUri)
  return dataUri
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
  // MultiConnect: Google Docs — a document with a folded corner and an
  // export-arrow badge (signals "content leaving the document"), in cyan —
  // deliberately distinct from Email/CRM's blue and Sheets/Airtable's teal,
  // the two nearest existing hues in this palette.
  'AI-CN-009': {
    gradient: ['#8DD8FF', '#0C7ABF'],
    mark: (c) => `<g fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-46 -70 L14 -70 L34 -50 L34 66 L-46 66 Z"/>
      <path d="M14 -70 L14 -50 L34 -50"/>
      <path d="M-26 -20 H14 M-26 4 H14 M-26 28 H-2"/>
      <circle cx="38" cy="52" r="28" fill="${c}" stroke="none"/>
    </g>
    <path d="M28 52 H48 M40 42 L50 52 L40 62" stroke="#0C7ABF" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
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
  // p.name.startsWith('Multi') alone is too broad — it also matches ordinary
  // English words like "Multilingual Support Inbox" that happen to start
  // with the same five letters as the brand prefix, giving a plain agent
  // config the Multi-branded logo treatment it has nothing to do with. Real
  // Multi-brand names smoosh the prefix directly into a capitalized word
  // with no space ("MultiAgents", "MultiVault", "MultiConnect: …") — /^Multi[A-Z]/
  // matches those and correctly excludes "Multilingual" (lowercase 'l').
  return p.category === 'connectors' || /^Multi[A-Z]/.test(p.name)
}

// thumbOnly is rendered as its own short, wide banner (1200x160) rather than
// a crop out of the full 1200x630 image — see the H_THUMB comment below for
// why that specific height, and buildThumbSvg for the icon+name layout.
// Content is centered on the canvas rather than placed at a fixed left
// offset: object-fit:cover crops symmetrically from both edges when the
// card is narrower than this source image, so anything not centered here
// risks landing outside the visible window at smaller card widths — that
// was the actual cause of the icon disappearing in an earlier version of
// this fix.
const H_THUMB = 160

function truncateForBanner(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name
  return name.slice(0, maxChars - 1).trimEnd() + '\u2026'
}

function buildThumbSvg(p: ApiProduct, photoDataUri?: string): string {
  const style = SOFTWARE_STYLE[p.sku] ?? DEFAULT_SOFTWARE_STYLE
  const [g1, g2] = style.gradient
  const gradId = `g-${p.sku.replace(/[^a-zA-Z0-9]/g, '')}-thumb`
  const cx = W / 2
  const cy = H_THUMB / 2

  const longName = p.name.length > 20
  const nameSize = longName ? 30 : 40
  const maxChars = longName ? 17 : 16
  const displayName = truncateForBanner(p.name, maxChars)

  if (photoDataUri) {
    // The photo IS the icon here — no vector mark, no gradient circle badge.
    // Name sits in a full-width strip along the bottom, not a pill centered
    // over the photo: a centered pill and the photo's own centered key
    // detail (the vault's dial, a lens, an LED) both want the same
    // horizontal real estate for the same reason — surviving a narrow
    // card's center-crop — and end up fighting over it. Concretely: for a
    // 10-character name at this font size, the pill spanned roughly
    // x=458-742 of the 1200-wide canvas, and MultiVault's dial was cropped
    // to sit at x≈535 — dead center of the pill, mostly hidden behind it,
    // not beside it. Separating them onto different vertical bands instead
    // (photo occupies the top, text strip along the bottom) means neither
    // has to dodge the other's horizontal position, and it costs only a
    // little vertical headroom rather than fighting for the same center.
    const stripH = 46
    return `
<svg width="${W}" height="${H_THUMB}" viewBox="0 0 ${W} ${H_THUMB}" xmlns="http://www.w3.org/2000/svg">
  <image href="${photoDataUri}" x="0" y="0" width="${W}" height="${H_THUMB}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="${H_THUMB - stripH}" width="${W}" height="${stripH}" fill="#0B0E14" fill-opacity="0.78"/>
  <text x="${cx}" y="${H_THUMB - stripH / 2 + nameSize * 0.32}" font-family="Inter" font-weight="700" font-size="${Math.min(nameSize, 26)}" fill="#F4EBDC" text-anchor="middle">${esc(displayName)}</text>
</svg>`.trim()
  }

  const iconR = 40
  const iconD = iconR * 2
  const gap = 24
  const avgCharW = nameSize * 0.56
  const textW = displayName.length * avgCharW
  const contentW = iconD + gap + textW
  const startX = cx - contentW / 2
  const iconCx = startX + iconR
  const textX = startX + iconD + gap

  return `
<svg width="${W}" height="${H_THUMB}" viewBox="0 0 ${W} ${H_THUMB}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="100%" stop-color="${g2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H_THUMB}" fill="url(#${gradId})"/>
  <circle cx="${iconCx}" cy="${cy}" r="${iconR}" fill="#FFFFFF" fill-opacity="0.14"/>
  <g transform="translate(${iconCx}, ${cy}) scale(0.42)">
    ${style.mark('#FFFFFF')}
  </g>
  <text x="${textX}" y="${cy + nameSize * 0.34}" font-family="Inter" font-weight="700" font-size="${nameSize}" fill="#FFFFFF">${esc(displayName)}</text>
</svg>`.trim()
}

function buildSoftwareSvg(p: ApiProduct, photoDataUri?: string): string {
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

  if (photoDataUri) {
    // Photo full-bleed, name + store/SKU footer over a bottom fade — same
    // "the photo IS the art" stance as buildThumbSvg's photo path, just with
    // room for the usual footer since this version isn't cropped to a sliver.
    return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade-${gradId}" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0B0E14" stop-opacity="0.92"/>
      <stop offset="38%" stop-color="#0B0E14" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <image href="${photoDataUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${W}" height="${H}" fill="url(#fade-${gradId})"/>
  <text x="60" y="${H - 110}" font-family="Inter" font-weight="700" font-size="${nameSize}" fill="#F4EBDC">${esc(p.name)}</text>
  <text x="60" y="${H - 46}" font-family="Inter" font-weight="700" font-size="19" letter-spacing="3" fill="#F4EBDC" fill-opacity="0.7">${esc(STORE)}</text>
  <text x="${W - 60}" y="${H - 46}" font-family="JetBrains Mono" font-size="17" fill="#F4EBDC" fill-opacity="0.55" text-anchor="end">${esc(p.sku)}</text>
</svg>`.trim()
  }

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
  // Thumbnail and full images are separate PATHS (/product-image/thumb/:sku.png
  // vs /product-image/:sku.png), not the same path with a ?variant=thumb query
  // string as this used to be. A query string is not a safe way to distinguish
  // two cached responses on every CDN: some cache configurations key on the
  // path alone and ignore the query entirely, which silently serves whichever
  // variant happened to be cached first — observed in production as the full
  // 1200x630 image (whose Schema.org/social use pre-dates the thumbnail
  // feature, and so was already cached under the bare path) being squeezed
  // into the 130px-tall card slot instead of the dedicated thumbnail crop,
  // cropping out the exact detail (an LED, a dial) the thumbnail crop exists
  // to keep in frame. Two distinct paths are unambiguous under any CDN's
  // cache-key scheme, query-string handling included or not.
  // Optional /v{N}/ segment right after /product-image/ — present only to
  // change the URL when we bump ASSET_VERSION below, forcing a fresh fetch
  // past Netlify's 24h edge cache (Cache-Control: s-maxage=86400 further
  // down) instead of waiting it out. Purely a cache-buster: it's matched
  // and discarded, never used to look anything up. Optional (the regex
  // still matches with it absent) so the existing unversioned URLs baked
  // into seo.ts and pages.ts for Schema.org/social images keep working
  // unchanged — only Index.html's own card-grid requests need to force a
  // refresh on demand, so only those need to include it.
  const thumbMatch = pathname.match(/^\/product-image\/(?:v\d+\/)?thumb\/(.+)\.png$/)
  const fullMatch = pathname.match(/^\/product-image\/(?:v\d+\/)?(.+)\.png$/)
  const match = thumbMatch ?? fullMatch
  if (!match) return new Response('Not found', { status: 404 })
  const sku = decodeURIComponent(match[1])
  const thumbOnly = Boolean(thumbMatch)

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
    const isSoftware = isSoftwareProduct(product)
    const photoStyle = photoStyleFor(product)
    const photoDataUri = photoStyle
      ? await getPhotoDataUri(req.url, thumbOnly ? photoStyle.banner : photoStyle.full)
      : undefined
    const hasPhoto = Boolean(photoDataUri)
    // Whether this SKU's icon is a plain vector shape (no font needed) or
    // the DEFAULT_SOFTWARE_STYLE ">_" glyph — an SVG <text> element set in
    // JetBrains Mono (see its mark() above), for any SKU without its own
    // SOFTWARE_STYLE entry. Irrelevant once a photo replaces the icon
    // entirely, which — now that every catalog category has a fallback
    // photo (see CATEGORY_PHOTO_STYLE) — is effectively always the case;
    // the vector-icon path only still fires as a defensive fallback if a
    // photo genuinely can't be found for some reason.
    const usesTextGlyph = isSoftware && !hasPhoto && !SOFTWARE_STYLE[product.sku]
    // Inter renders product-name text in every path now. Mono renders
    // either the default ">_" glyph, or the full (non-thumbnail) image's
    // SKU footer — which every photo-backed full image shows too, not just
    // the vector-icon one. buildSvg (the plain template, reached only if
    // somehow neither a photo nor SOFTWARE_STYLE applies) uses no mono text
    // at all.
    const needsMono = hasPhoto ? !thumbOnly : isSoftware && (usesTextGlyph || !thumbOnly)
    const interFont = await getFont()
    const monoFont = needsMono ? await getMonoFont() : null
    const svg = thumbOnly
      ? buildThumbSvg(product, photoDataUri)
      : isSoftware || hasPhoto
        ? buildSoftwareSvg(product, photoDataUri)
        : buildSvg(product)
    const fontBuffers = [interFont, monoFont].filter((f): f is Uint8Array => f !== null)
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
