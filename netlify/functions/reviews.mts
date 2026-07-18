// Netlify Function: /api/reviews
//   GET               — returns { aggregates } keyed by SKU. Each aggregate has
//                        { count, average, sample }, where `sample` is one
//                        representative review. The homepage SEO edge function
//                        uses this to attach AggregateRating + Review to every
//                        product in the catalog ItemList.
//   GET ?sku=AI-XX-000 — returns { aggregate, reviews } for a single product.
//                        The product-page edge function uses this to render the
//                        review list and its AggregateRating + Review JSON-LD.
//   POST { sku, author, rating, body? } — records a review and returns
//                        { review }. Backs the storefront's in-modal review form
//                        and the post-purchase review prompt. Re-submitting as
//                        the same author for the same product updates the prior
//                        review rather than duplicating it.
//
// Reachable at /api/reviews via the /api/* rewrite in netlify.toml. On any
// database error GET returns empty results so the SEO layer degrades gracefully
// (no ratings) rather than failing the page.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

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

export default async (req: Request, context: Context) => {
  // ---- POST: record a review ----
  if (req.method === 'POST') {
    // Unauthenticated write that feeds public ratings — cap per IP so it can't
    // be scripted to flood a product with reviews. Fail-open (see lib).
    const rl = await checkRateLimit('reviews', context.ip, { limit: 8, windowMs: 60 * 60 * 1000 })
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSec)

    let sku = ''
    let author = ''
    let rating = 0
    let body = ''
    try {
      const b = await req.json()
      sku = String(b?.sku ?? '').trim().slice(0, 32)
      author = String(b?.author ?? '').trim().slice(0, 80)
      rating = Math.round(Number(b?.rating))
      body = String(b?.body ?? '').trim().slice(0, 2000)
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!sku) return Response.json({ error: 'A product is required.' }, { status: 400 })
    if (!author) return Response.json({ error: 'Please add your name.' }, { status: 400 })
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: 'Pick a rating from 1 to 5 stars.' }, { status: 400 })
    }

    // Only accept reviews for products that actually exist in the catalog.
    const { products } = await loadCatalog()
    if (!products.some((p) => p.sku === sku)) {
      return Response.json({ error: 'No product with that SKU.' }, { status: 404 })
    }

    try {
      const db = getDatabase()
      const rows = (await db.sql`
        INSERT INTO reviews (sku, author, rating, body)
        VALUES (${sku}, ${author}, ${rating}, ${body})
        ON CONFLICT (sku, author) DO NOTHING
        RETURNING author, rating, body, created_at
      `) as ReviewRow[]
      // A conflict means a review already exists for this (sku, author). We
      // deliberately do NOT overwrite it: author names are shown publicly, so
      // a DO UPDATE would let anyone vandalize an existing review (including the
      // seeded ones that feed AggregateRating) just by reusing its name. Ask for
      // a different name instead.
      if (!rows.length) {
        return Response.json(
          { error: 'A review under that name already exists for this product. Try a different name.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } },
        )
      }
      return Response.json({ review: toReview(rows[0]) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      console.error('reviews POST error:', (err as Error).message)
      return Response.json({ error: 'Could not save your review right now.' }, { status: 500 })
    }
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
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
