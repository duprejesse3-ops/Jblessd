// Live context for $Odds Agent (AI-AG-114) only — fetched fresh on each run,
// before the prompt is built, so the model reasons against the actual
// current market price and recent headlines instead of trusting whatever
// the buyer typed in (which might be stale by the time they submit).
//
// Both sources here are genuinely free — no API key, no account, no paid
// tier: Polymarket's public Gamma API for market price data, and Google's
// public News RSS search for recent headlines. Deliberately NOT using any
// paid news API, per an explicit "free news" scope decision.
//
// HONESTY FLAG: both endpoint shapes below are written from best available
// knowledge, not verified live — this sandbox has no network access to
// polymarket.com or news.google.com to confirm the exact current response
// format. Verify both against a real request before this goes live:
//   - Polymarket Gamma API: https://docs.polymarket.com (Markets endpoint)
//   - Google News RSS: confirm the query format still returns valid RSS
// Everything here is written to fail safely if either shape has drifted —
// a bad response degrades to "unavailable," not a crash — but "degrades
// gracefully" is not the same as "confirmed working." Test with one real
// market URL and one real question before trusting this in front of a
// paying buyer.

const FETCH_TIMEOUT_MS = 6000

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MultiNicheAI-OddsAgent/1.0' } })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

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
  const res = await fetchWithTimeout(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`, FETCH_TIMEOUT_MS)
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

interface Headline {
  title: string
  date: string
}

async function fetchRecentHeadlines(query: string): Promise<Headline[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
  if (!res) return []
  try {
    const xml = await res.text()
    const items: Headline[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRegex.exec(xml)) && items.length < 6) {
      const block = m[1]
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()
      const date = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim()
      if (title) items.push({ title: title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), date: date ?? '' })
    }
    return items
  } catch {
    return []
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
