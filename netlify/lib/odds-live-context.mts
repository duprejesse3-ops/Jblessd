// Live context for $Odds Agent (AI-AG-114) only — fetched fresh on each run,
// before the prompt is built, so the model reasons against the actual
// current market price and recent headlines instead of trusting whatever
// the buyer typed in (which might be stale by the time they submit).
//
// Both sources here are genuinely free — no API key, no account, no paid
// tier: Polymarket's public Gamma API for market price data, and (via
// live-fetch.mts, shared with MultiSignal) Google's public News RSS search
// for recent headlines. Deliberately NOT using any paid news API, per an
// explicit "free news" scope decision.
//
// HONESTY FLAG: the Polymarket endpoint shape below is written from best
// available knowledge, not verified live — this sandbox has no network
// access to polymarket.com to confirm the exact current response format.
// Verify against https://docs.polymarket.com (Markets endpoint) with one
// real market URL before trusting this in front of a paying buyer. See
// live-fetch.mts for the equivalent flag on the shared News RSS piece.

import { fetchWithTimeout, fetchRecentHeadlines } from './live-fetch.mjs'

/** Pulls a Polymarket market slug out of a pasted market URL, or null if it doesn't look like one. */
function extractSlug(marketUrl: string): string | null {
  const match = marketUrl.trim().match(/polymarket\.com\/(?:event|market)\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

interface LivePrice {
  question: string
  priceText: string
}

async function fetchLivePrice(marketUrl: string): Promise<LivePrice | null> {
  const slug = extractSlug(marketUrl)
  if (!slug) return null
  const res = await fetchWithTimeout(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`)
  if (!res) return null
  try {
    const data = await res.json()
    const market = Array.isArray(data) ? data[0] : data
    if (!market) return null
    const outcomes: string[] = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes ?? []
    const prices: string[] = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices ?? []
    if (!outcomes.length || !prices.length) return null
    const priceText = outcomes.map((o, i) => `${o}: ${Math.round(parseFloat(prices[i]) * 100)}%`).join(', ')
    return { question: String(market.question ?? ''), priceText }
  } catch {
    return null
  }
}

/**
 * Builds a live-context text block for AI-AG-114, or an explicit
 * "unavailable" note if both fetches came back empty — never throws, and
 * never silently pretends to have live data it doesn't.
 */
export async function fetchOddsLiveContext(marketUrl: string, question: string): Promise<string> {
  const [price, headlines] = await Promise.all([
    marketUrl ? fetchLivePrice(marketUrl) : Promise.resolve(null),
    fetchRecentHeadlines(question || marketUrl),
  ])

  const parts: string[] = []
  if (price) {
    parts.push(`Live price, fetched just now from Polymarket: ${price.priceText}${price.question ? ` (market: "${price.question}")` : ''}.`)
  } else if (marketUrl) {
    parts.push('Live price lookup was attempted for the market URL given but did not succeed this run — treat the price the buyer typed as possibly stale, and say so if it matters.')
  }
  if (headlines.length) {
    parts.push(
      'Recent headlines, fetched just now, most recent first:\n' +
        headlines.map((h) => `- ${h.title}${h.date ? ` (${h.date})` : ''}`).join('\n'),
    )
  } else {
    parts.push('No recent headlines were found for this query this run — reason from general knowledge and whatever the buyer provided, and say plainly that no fresh news context was available.')
  }
  return parts.join('\n\n')
}
