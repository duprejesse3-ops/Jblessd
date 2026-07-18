// Netlify Function: /sitemap.xml
//
// Serves a sitemap generated from the live catalog so every product is
// discoverable to crawlers, not just the homepage. Each product is exposed as a
// crawlable product page (/product/SKU) with its own metadata and structured
// data. Falls back to the bundled catalog when the database is unreachable.
//
// Replaces the former static sitemap.xml so the list never goes stale.

import type { Config } from '@netlify/functions'
import { loadCatalog } from '../lib/db.mjs'

const SITE = 'https://jblessd.com'

// Role landing pages served by the pages edge function (/tools/:niche). Kept in
// sync with NICHE_LABEL there so every audience page is discoverable to crawlers.
const NICHES = ['founders', 'sales', 'marketers', 'developers', 'writers', 'students', 'architects', 'engineers']

// Outcome-based landing pages (/use-cases/:slug), kept in sync with the slugs
// the pages edge function knows how to render.
const USE_CASE_SLUGS = [
  'draft-investor-updates',
  'triage-support-tickets',
  'hit-inbox-zero',
  'ship-content-faster',
  'run-better-standups',
  'research-with-citations',
]

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function recentProofIds(req: Request): Promise<string[]> {
  try {
    const res = await fetch(new URL('/api/proof', req.url), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { proofs?: Array<{ id: string }> }
    return (data.proofs ?? []).map((p) => p.id).filter(Boolean)
  } catch {
    return []
  }
}

export default async (req: Request) => {
  const { products } = await loadCatalog()
  const proofIds = await recentProofIds(req)

  const urls = [
    `  <url>\n    <loc>${SITE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE}/refund-policy/</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.4</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE}/proof</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE}/use-cases</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE}/updates</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    ...NICHES.map((niche) => {
      const loc = `${SITE}/tools/${encodeURIComponent(niche)}`
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    }),
    ...USE_CASE_SLUGS.map((slug) => {
      const loc = `${SITE}/use-cases/${encodeURIComponent(slug)}`
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    }),
    ...products.map((p) => {
      const loc = `${SITE}/product/${encodeURIComponent(p.sku)}`
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    }),
    ...proofIds.map((id) => {
      const loc = `${SITE}/proof/${encodeURIComponent(id)}`
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`
    }),
  ]

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join('\n') +
    `\n</urlset>\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export const config: Config = {
  path: '/sitemap.xml',
}
