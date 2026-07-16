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

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default async () => {
  const { products } = await loadCatalog()

  const urls = [
    `  <url>\n    <loc>${SITE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE}/refund-policy/</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.4</priority>\n  </url>`,
    ...products.map((p) => {
      const loc = `${SITE}/product/${encodeURIComponent(p.sku)}`
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
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
