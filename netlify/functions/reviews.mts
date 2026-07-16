// Netlify Function: /api/reviews
//   GET               — returns { aggregates } keyed by SKU. Each aggregate has
//                        { count, average, sample }, where `sample` is one
//                        representative review. The homepage SEO edge function
//                        uses this to attach AggregateRating + Review to every
//                        product in the catalog ItemList.
//   GET ?sku=AI-XX-000 — returns { aggregate, reviews } for a single product.
//                        The product-page edge function uses this to render the
//                        review list and its AggregateRating + Review JSON-LD.
//
// Reachable at /api/reviews via the /api/* rewrite in netlify.toml. On any
// database error it returns empty results so the SEO layer degrades gracefully
// (no ratings) rather than failing the page.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

interface ReviewRow {
  author: string
  rating: number
  body: string
  created_at: string | Date | null
}

function toReview(r: ReviewRow) {
  return {
    author: r.author,
    rating: Number(r.rating),
    body: r.body,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  const cacheHeaders = { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' }
  const sku = new URL(req.url).searchParams.get('sku')?.trim()

  try {
    const db = getDatabase()

    if (sku) {
      const [agg] = (await db.sql`
        SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1) AS average
        FROM reviews
        WHERE sku = ${sku}
      `) as Array<{ count: number; average: number | string }>

      const rows = (await db.sql`
        SELECT author, rating, body, created_at
        FROM reviews
        WHERE sku = ${sku}
        ORDER BY rating DESC, created_at DESC
      `) as ReviewRow[]

      const count = Number(agg?.count ?? 0)
      return Response.json(
        {
          aggregate: count > 0 ? { count, average: Number(agg.average) } : null,
          reviews: rows.map(toReview),
        },
        { headers: cacheHeaders },
      )
    }

    // No SKU: aggregates for the whole catalog, plus one representative review
    // per product (highest rating, then most recent) for the ItemList markup.
    const aggRows = (await db.sql`
      SELECT sku, COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1) AS average
      FROM reviews
      GROUP BY sku
    `) as Array<{ sku: string; count: number; average: number | string }>

    const sampleRows = (await db.sql`
      SELECT DISTINCT ON (sku) sku, author, rating, body, created_at
      FROM reviews
      ORDER BY sku, rating DESC, created_at DESC
    `) as Array<ReviewRow & { sku: string }>

    const samples: Record<string, ReturnType<typeof toReview>> = {}
    for (const r of sampleRows) samples[r.sku] = toReview(r)

    const aggregates: Record<string, { count: number; average: number; sample?: ReturnType<typeof toReview> }> = {}
    for (const r of aggRows) {
      aggregates[r.sku] = {
        count: Number(r.count),
        average: Number(r.average),
        ...(samples[r.sku] ? { sample: samples[r.sku] } : {}),
      }
    }

    return Response.json({ aggregates }, { headers: cacheHeaders })
  } catch (err) {
    console.error('reviews function:', (err as Error).message)
    // Degrade gracefully: empty results keep the SEO layer working without stars.
    return Response.json(sku ? { aggregate: null, reviews: [] } : { aggregates: {} }, { headers: cacheHeaders })
  }
}

export const config: Config = {
  path: '/api/reviews',
}
