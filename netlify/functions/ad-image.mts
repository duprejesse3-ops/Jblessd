// Netlify Function: /api/ad-image
//
// Renders an on-brand ad creative for a single product (or the whole store) as
// an SVG image, sized to Google Ads' three core image-asset aspect ratios.
//
// The store sells DIGITAL products (prompt packs, automations, templates, agent
// configs), so there are no product photos to advertise with. This function
// manufactures one: a polished, catalog-grounded creative built from the same
// brand palette and category glyphs the storefront uses, so the owner has a
// real image to feed Google Ads (Performance Max, Demand Gen, Display).
//
//   GET /api/ad-image?sku=AI-PP-001&size=square      -> image/svg+xml
//   GET /api/ad-image?size=landscape                 -> whole-store creative
//
// size ∈ { landscape (1200×628, 1.91:1), square (1200×1200, 1:1),
//          portrait (960×1200, 4:5) } — Google's recommended asset dimensions.
//
// The SVG is deterministic and grounded in the real catalog (nothing invented),
// so it is served publicly with a long cache: it is marketing collateral and
// holds no secrets. Google Ads only accepts raster uploads, so the admin
// console's `creatives` command rasterizes this SVG to a real PNG in the browser
// (canvas) before saving it. Netlify Image CDN cannot do that job — it only
// transforms raster sources and passes SVG through untouched.

import type { Config } from '@netlify/functions'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const STORE_NAME = 'MULTINICHE AI'
const DOMAIN = 'jblessd.com'

// Google Ads image-asset dimensions, keyed by the friendly size name the UI uses.
const SIZES: Record<string, { w: number; h: number }> = {
  landscape: { w: 1200, h: 628 }, // 1.91:1
  square: { w: 1200, h: 1200 }, // 1:1
  portrait: { w: 960, h: 1200 }, // 4:5
}

// Per-category accent + the storefront's own line-art glyph (64×64 viewBox).
// Kept in sync with the [data-cat] rules in index.html so the ad creative reads
// as the same brand as the product cards a shopper lands on. Colors match
// index.html's current --art-glow / glyph stroke values exactly (brass /
// teal / purple / indigo) — these previously still had this file's pre-
// rebrand all-pink/coral palette, which is what made generated creatives
// look off-brand next to the actual site.
const CATEGORY: Record<
  Product['category'],
  { accent: string; glow: string; glyph: string }
> = {
  prompts: {
    accent: '#FFB020',
    glow: 'rgba(255,176,32,0.22)',
    glyph: "<path d='M16 20 28 32 16 44'/><path d='M34 44h16'/>",
  },
  automations: {
    accent: '#22D3B0',
    glow: 'rgba(34,211,176,0.18)',
    glyph:
      "<circle cx='15' cy='32' r='6'/><circle cx='49' cy='32' r='6'/><path d='M21 32h16'/><path d='M33 26l6 6-6 6'/>",
  },
  templates: {
    accent: '#8B7CFF',
    glow: 'rgba(139,124,255,0.16)',
    glyph:
      "<rect x='19' y='12' width='26' height='40' rx='3'/><path d='M25 24h14M25 32h14M25 40h9'/>",
  },
  agents: {
    accent: '#6366F1',
    glow: 'rgba(99,102,241,0.24)',
    glyph: "<path d='M32 9 52 20.5v23L32 55 12 43.5v-23z'/><circle cx='32' cy='32' r='5.5'/>",
  },
}

// Brand fallback used for the whole-store creative (no single category).
// Matches .brand-mark's actual current color in index.html (#FF2A2A with a
// rgba(255,42,42,.35) glow) — unlike the per-category colors above, the
// logo mark itself kept its original red identity through the rebrand, so
// this intentionally stays red rather than moving to teal/brass.
const STORE_ART = {
  accent: '#FF2A2A',
  glow: 'rgba(255,42,42,0.28)',
  // The header wordmark's "M" mountain mark, redrawn in the 64-box the glyphs use.
  glyph: "<path d='M12 50V18l20 17 20-17v32'/><path d='M25 56h14'/>",
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Naive word-wrap for SVG text (SVG has no auto-wrap). Estimates glyph width at
// ~0.58em for a bold sans face and breaks into at most `maxLines` lines, adding
// an ellipsis only when words genuinely do not fit.
function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const charW = fontSize * 0.58
  const perLine = Math.max(6, Math.floor(maxWidth / charW))
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  let truncated = false
  for (const word of words) {
    const next = cur ? cur + ' ' + word : word
    if (next.length > perLine && cur) {
      // Only stop once the last permitted line is already full; breaking any
      // earlier drops words that still had a line to sit on.
      if (lines.length === maxLines - 1) {
        truncated = true
        break
      }
      lines.push(cur)
      cur = word
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  if (truncated && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s.,;:—–-]+$/, '') + '…'
  }
  return lines
}

// A rounded-square badge holding the category glyph, scaled/centered from its
// native 64-unit box. Returns SVG markup positioned at (x, y) with side length b.
function badge(x: number, y: number, b: number, accent: string, glyph: string): string {
  const pad = b * 0.24
  const scale = (b - pad * 2) / 64
  const gx = x + pad
  const gy = y + pad
  const sw = Math.max(2.5, 3.4 / scale) // keep the line weight visually constant
  return (
    `<rect x="${x}" y="${y}" width="${b}" height="${b}" rx="${b * 0.22}" ` +
    // Neutral fill — was a fixed pink tint (rgba(255,122,122,...)) that only
    // worked when every category was some shade of pink. With per-category
    // accents now spanning brass/teal/purple/indigo/red, the badge interior
    // needs to be accent-agnostic; the accent still carries entirely through
    // the stroke and glyph color.
    `fill="rgba(255,255,255,0.05)" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>` +
    `<g transform="translate(${gx} ${gy}) scale(${scale.toFixed(4)})" fill="none" ` +
    `stroke="${accent}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">` +
    `${glyph}</g>`
  )
}

// Small pill used for the price and the category tag.
function pill(x: number, y: number, text: string, fontSize: number, accent: string): string {
  const padX = fontSize * 0.9
  const w = text.length * fontSize * 0.62 + padX * 2
  const h = fontSize * 1.9
  return (
    `<g>` +
    `<rect x="${x}" y="${y}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="${(h / 2).toFixed(0)}" ` +
    // Same reasoning as badge()'s fill above — neutral instead of a fixed
    // gold tint so it reads correctly under every category's accent color.
    `fill="rgba(255,255,255,0.06)" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"/>` +
    `<text x="${(x + w / 2).toFixed(0)}" y="${(y + h / 2).toFixed(0)}" fill="${accent}" ` +
    `font-family="monospace" font-size="${fontSize}" font-weight="700" text-anchor="middle" ` +
    `dominant-baseline="central" letter-spacing="0.5">${esc(text)}</text>` +
    `</g>`
  )
}

function renderSvg(product: Product | null, size: { w: number; h: number }): string {
  const { w, h } = size
  // Fall back to the brand mark for a category with no glyph yet: a creative that
  // still renders beats a 500 that shows up as a broken image in the console.
  const art = (product && CATEGORY[product.category]) || STORE_ART
  const accent = art.accent
  const row = w / h > 1.4 // landscape gets a side-by-side layout

  const name = product ? product.name : 'Ready-to-run AI tools'
  const kicker = product
    ? `${CATEGORY_LABEL[product.category] ?? product.category} · ${NICHE_LABEL[product.niche] ?? product.niche}`
    : 'Prompts · Automations · Templates · Agents'
  const sub = product
    ? product.blurb
    : 'Prompt packs, automations, templates & agent configs.'

  // ---- shared defs: background gradient, category glow, faint grid ----
  // Gradient stops and grid line now match index.html's actual --ink/--panel/
  // --panel-2/--line-soft scale (navy-black) instead of this file's old
  // red-tinted background (#110807 → #050000, #2A0A0A grid), which was left
  // over from before the site's navy/teal/brass rebrand.
  const defs =
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#121826"/><stop offset="0.55" stop-color="#0A0E16"/>` +
    `<stop offset="1" stop-color="#0D111C"/></linearGradient>` +
    `<radialGradient id="glow" cx="50%" cy="42%" r="60%">` +
    `<stop offset="0" stop-color="${art.glow}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>` +
    `</radialGradient>` +
    `<pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">` +
    `<path d="M46 0H0V46" fill="none" stroke="#161C29" stroke-width="1"/></pattern>` +
    `</defs>`

  const bg =
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#grid)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#glow)"/>` +
    // A thin accent frame keeps the creative from bleeding into a dark ad slot.
    `<rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="14" fill="none" ` +
    `stroke="${accent}" stroke-opacity="0.28" stroke-width="2"/>`

  const pad = Math.round(w * (row ? 0.06 : 0.09))

  // ---- brand wordmark (top-left) ----
  const brandY = pad + 6
  const brand =
    `<g transform="translate(${pad} ${brandY})">` +
    `<g fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="scale(1.1)">` +
    `<path d="M4 18V6l8 7 8-7v12"/><path d="M9 21h6"/></g>` +
    `<text x="34" y="16" fill="#EEF1F7" font-family="monospace" font-size="20" font-weight="700" letter-spacing="3">${STORE_NAME}</text>` +
    `</g>`

  // ---- CTA / domain strip (bottom-left) ----
  const ctaText = product ? 'Get it today' : 'Browse the catalog'
  const cta =
    `<g transform="translate(${pad} ${h - pad - 34})">` +
    `<rect x="0" y="0" width="${Math.round(ctaText.length * 12 + 44)}" height="46" rx="23" fill="${accent}"/>` +
    `<text x="${Math.round((ctaText.length * 12 + 44) / 2)}" y="24" fill="#0A0E16" font-family="sans-serif" ` +
    `font-size="19" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(ctaText)}</text>` +
    `<text x="${Math.round(ctaText.length * 12 + 44) + 20}" y="24" fill="#9AA4BC" font-family="monospace" ` +
    `font-size="18" dominant-baseline="central">${DOMAIN}</text>` +
    `</g>`

  let content = ''
  if (row) {
    // Landscape: glyph badge on the left, text column on the right.
    const b = Math.round(h * 0.42)
    const bx = pad
    const by = Math.round(h / 2 - b / 2)
    const tx = bx + b + Math.round(w * 0.05)
    const tw = w - tx - pad
    const nameSize = 52
    const nameLines = wrap(name, nameSize, tw, 3)
    const ty = Math.round(h / 2 - (nameLines.length * nameSize * 1.12) / 2) - 30
    const kickerY = ty - 34
    content =
      badge(bx, by, b, accent, art.glyph) +
      `<text x="${tx}" y="${kickerY}" fill="${accent}" font-family="monospace" font-size="19" font-weight="700" letter-spacing="1.5">${esc(kicker.toUpperCase())}</text>` +
      nameLines
        .map((ln, i) => {
          const y = ty + i * Math.round(nameSize * 1.12) + nameSize
          return `<text x="${tx}" y="${y}" fill="#EEF1F7" font-family="sans-serif" font-size="${nameSize}" font-weight="800">${esc(ln)}</text>`
        })
        .join('') +
      (() => {
        const subY = ty + nameLines.length * Math.round(nameSize * 1.12) + nameSize + 6
        const subLines = wrap(sub, 24, tw, 2)
        return subLines
          .map((ln, i) => `<text x="${tx}" y="${subY + i * 32}" fill="#9AA4BC" font-family="sans-serif" font-size="24">${esc(ln)}</text>`)
          .join('')
      })() +
      (product ? pill(tx, by + b - 4, `$${product.price.toFixed(0)}`, 22, accent) : '')
  } else {
    // Square / portrait: centered stack — badge, kicker, name, sub, price.
    const cx = w / 2
    const b = Math.round(w * 0.30)
    const by = Math.round(h * (w === h ? 0.22 : 0.20))
    let y = by + b + 74
    const nameSize = w === h ? 60 : 56
    const nameLines = wrap(name, nameSize, w - pad * 2, 3)
    const kicker0 = kicker.toUpperCase()
    content =
      badge(cx - b / 2, by, b, accent, art.glyph) +
      `<text x="${cx}" y="${y}" fill="${accent}" font-family="monospace" font-size="22" font-weight="700" letter-spacing="2" text-anchor="middle">${esc(kicker0)}</text>`
    y += 30
    content += nameLines
      .map((ln, i) => {
        const ly = y + i * Math.round(nameSize * 1.12) + nameSize
        return `<text x="${cx}" y="${ly}" fill="#EEF1F7" font-family="sans-serif" font-size="${nameSize}" font-weight="800" text-anchor="middle">${esc(ln)}</text>`
      })
      .join('')
    y += nameLines.length * Math.round(nameSize * 1.12) + nameSize + 10
    const subLines = wrap(sub, 27, w - pad * 2, 3)
    content += subLines
      .map((ln, i) => `<text x="${cx}" y="${y + i * 38}" fill="#9AA4BC" font-family="sans-serif" font-size="27" text-anchor="middle">${esc(ln)}</text>`)
      .join('')
    if (product) {
      const py = y + subLines.length * 38 + 18
      const fs = 22
      const pText = `$${product.price.toFixed(0)} · ${product.format}`
      const pw = pText.length * fs * 0.62 + fs * 1.8
      content += pill(cx - pw / 2, py, pText, fs, accent)
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} — ${STORE_NAME} ad creative">` +
    defs +
    bg +
    brand +
    content +
    cta +
    `</svg>`
  )
}

export default async (req: Request) => {
  const url = new URL(req.url)
  const sizeKey = (url.searchParams.get('size') || 'square').toLowerCase()
  const size = SIZES[sizeKey] || SIZES.square
  const sku = (url.searchParams.get('sku') || '').trim()

  let product: Product | null = null
  if (sku && sku.toUpperCase() !== 'STORE') {
    try {
      const { products } = await loadCatalog()
      product = products.find((p) => p.sku === sku) || null
    } catch {
      product = null
    }
    if (!product) {
      return new Response('Unknown product SKU', { status: 404 })
    }
  }

  const svg = renderSvg(product, size)
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Deterministic collateral — cache hard at the edge; Image CDN keys its
      // rasterized PNG off this response.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

export const config: Config = {
  path: '/api/ad-image',
}
