// Netlify Function: GET /api/featured
// Public read of currently-featured (trending) products, for the homepage
// to highlight. Auto-expires — only returns rows not yet past expires_at.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

interface FeaturedRow {
  sku: string
  reason: string
  featured_at: string
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }
  try {
    const db = getDatabase()
    const rows = (await db.sql`
      SELECT sku, reason, featured_at FROM featured_products
      WHERE expires_at > now()
      ORDER BY featured_at DESC
    `) as FeaturedRow[]
    return Response.json(
      { featured: rows },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
    )
  } catch (err) {
    console.error('featured GET error:', (err as Error).message)
    return Response.json({ featured: [] })
  }
}

export const config: Config = {
  path: '/api/featured',
}
