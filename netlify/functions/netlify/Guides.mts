// Netlify Function: /api/guides
//
// Public read access to AI-generated SEO landing pages (see
// guides-generator.mts, which writes these — auto-published, no admin
// review step). This endpoint is what the pages edge function fetches to
// render /guides/:niche/:category and /guides, and what sitemap.mts fetches
// to list them for crawlers.
//
//   GET /api/guides                        — list all published guides
//   GET /api/guides?niche=X&category=Y     — a single guide
//
// A page view is optionally logged for simple conversion attribution later
// (which generated pages actually lead to a free-pack claim or a sale) —
// pass &log=view to record one. Fire-and-forget: a logging failure never
// affects the response.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

const READ_CACHE: Record<string, string> = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400, durable',
}

interface GuideRow {
  slug: string
  niche: string
  category: string
  title: string
  metaDescription: string
  bodyHtml: string
  productSkus: string[]
  generatedAt: string | null
  publishedAt: string | null
}

function normalizeRow(row: any): GuideRow {
  return {
    slug: row.slug,
    niche: row.niche,
    category: row.category,
    title: row.title,
    metaDescription: row.meta_description,
    bodyHtml: row.body_html,
    productSkus: row.product_skus ?? [],
    generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
  }
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const niche = url.searchParams.get('niche')
  const category = url.searchParams.get('category')

  try {
    const db = getDatabase()

    if (niche && category) {
      const slug = `${niche}/${category}`
      const rows = (await db.sql`
        SELECT slug, niche, category, title, meta_description, body_html, product_skus, generated_at, published_at
        FROM seo_pages
        WHERE slug = ${slug} AND status = 'published'
        LIMIT 1
      `) as any[]
      if (!rows.length) {
        return Response.json({ guide: null }, { status: 404, headers: READ_CACHE })
      }

      // Fire-and-forget view logging — never blocks or fails the response.
      if (url.searchParams.get('log') === 'view') {
        db.sql`
          INSERT INTO content_conversions (slug, session_id, event_type)
          VALUES (${slug}, ${url.searchParams.get('sid')}, 'view')
        `.catch((err: Error) => console.error('guides view log failed:', err.message))
      }

      return Response.json({ guide: normalizeRow(rows[0]) }, { headers: READ_CACHE })
    }

    const rows = (await db.sql`
      SELECT slug, niche, category, title, meta_description, body_html, product_skus, generated_at, published_at
      FROM seo_pages
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST, generated_at DESC
    `) as any[]
    return Response.json({ guides: rows.map(normalizeRow) }, { headers: READ_CACHE })
  } catch (err) {
    console.error('guides GET error:', (err as Error).message)
    return Response.json(
      { error: 'Guides are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } },
    )
  }
}

export const config: Config = {
  path: '/api/guides',
}
