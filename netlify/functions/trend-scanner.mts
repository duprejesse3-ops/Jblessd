// Scheduled function: trend-responsive merchandising.
//
// Looks for signals that a product is suddenly relevant — either an external
// X trending topic matching a product's name/blurb, or a spike in internal
// traffic (via ad_events landing data) referencing terms tied to a product —
// and temporarily features that product on the homepage.
//
// X's trends endpoint may not be available on all API tiers. This function
// tries it and falls back to internal-signal-only matching if the call fails,
// so a missing/paywalled endpoint never breaks the whole pipeline.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'

const FEATURE_WINDOW_HOURS = 48
const WOEID_WORLDWIDE = 1

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

interface TrendItem {
  name: string
  tweet_volume?: number | null
}

async function fetchXTrends(): Promise<TrendItem[]> {
  const apiKey = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return []

  try {
    const { TwitterApi } = await import('twitter-api-v2')
    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
    const trends = await client.v1.trendsByPlace(WOEID_WORLDWIDE)
    return (trends?.[0]?.trends ?? []) as TrendItem[]
  } catch (err) {
    console.log('[trend-scanner] X trends unavailable (tier/auth):', (err as Error).message)
    return []
  }
}

interface LandingRow {
  utm_term: string | null
  utm_campaign: string | null
  landing_path: string | null
}

async function fetchInternalTerms(db: ReturnType<typeof getDatabase>): Promise<string[]> {
  try {
    const rows = (await db.sql`
      SELECT utm_term, utm_campaign, landing_path FROM ad_events
      WHERE created_at > now() - interval '1 day'
      AND (utm_term IS NOT NULL OR utm_campaign IS NOT NULL)
      LIMIT 200
    `) as LandingRow[]
    const terms = new Set<string>()
    for (const r of rows) {
      if (r.utm_term) terms.add(r.utm_term)
      if (r.utm_campaign) terms.add(r.utm_campaign)
    }
    return Array.from(terms)
  } catch (err) {
    console.log('[trend-scanner] internal traffic query failed:', (err as Error).message)
    return []
  }
}

interface ApiProduct {
  sku: string
  name: string
  blurb: string
  spec: string
}

function matchTermToProducts(term: string, products: ApiProduct[]): ApiProduct[] {
  const clean = term.replace(/^#/, '').toLowerCase()
  if (clean.length < 3) return []
  const pattern = new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  return products.filter((p) => pattern.test(`${p.name} ${p.blurb} ${p.spec}`))
}

export default async (_req: Request) => {
  const db = getDatabase()
  const { products } = await loadCatalog()

  const xTrends = await fetchXTrends()
  const internalTerms = await fetchInternalTerms(db)

  const allSignals: { source: string; term: string; strength: number }[] = [
    ...xTrends.map((t) => ({ source: 'x_trend', term: t.name, strength: t.tweet_volume ?? 1 })),
    ...internalTerms.map((t) => ({ source: 'internal_traffic', term: t, strength: 5 })),
  ]

  if (!allSignals.length) {
    console.log('[trend-scanner] no external or internal signals available this run')
    return Response.json({ signals: 0, featured: 0 })
  }

  let signalsRecorded = 0
  let featured = 0
  const featuredSkus = new Set<string>()

  for (const signal of allSignals) {
    const matches = matchTermToProducts(signal.term, products)
    for (const product of matches) {
      try {
        await db.sql`
          INSERT INTO trend_signals (id, source, term, matched_sku, strength)
          VALUES (${shortId()}, ${signal.source}, ${signal.term}, ${product.sku}, ${signal.strength})
        `
        signalsRecorded++
      } catch (err) {
        console.error('[trend-scanner] failed to record signal:', (err as Error).message)
      }

      if (!featuredSkus.has(product.sku)) {
        featuredSkus.add(product.sku)
        try {
          await db.sql`
            INSERT INTO featured_products (sku, reason, expires_at)
            VALUES (
              ${product.sku},
              ${`Trending: "${signal.term}" (${signal.source})`},
              now() + interval '${FEATURE_WINDOW_HOURS} hours'
            )
            ON CONFLICT (sku) DO UPDATE SET
              reason = EXCLUDED.reason,
              featured_at = now(),
              expires_at = EXCLUDED.expires_at
          `
          featured++
        } catch (err) {
          console.error('[trend-scanner] failed to feature product:', (err as Error).message)
        }
      }
    }
  }

  console.log(`[trend-scanner] ${signalsRecorded} signal(s) recorded, ${featured} product(s) featured`)
  return Response.json({ signals: signalsRecorded, featured })
}

export const config: Config = {
  schedule: '0 */6 * * *',
}
