// Shared, product-agnostic live-fetch helpers. Extracted out of
// odds-live-context.mts once a second product (MultiSignal) needed the same
// headline-search logic — one copy of "how do we search Google News RSS"
// beats two copies that could quietly drift apart, same reasoning as every
// other shared-doctrine decision this session.
//
// HONESTY FLAG: same as everywhere else this pattern shows up — the Google
// News RSS shape below is written from best available knowledge, not
// verified live from this sandbox. Verify with one real query before
// trusting it in front of a paying buyer.

const FETCH_TIMEOUT_MS = 6000

export async function fetchWithTimeout(url: string, ms: number = FETCH_TIMEOUT_MS): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MultiNicheAI-LiveFetch/1.0' } })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface Headline {
  title: string
  date: string
}

/** Free, keyless Google News RSS search — no account, no paid tier. */
export async function fetchRecentHeadlines(query: string, limit = 6): Promise<Headline[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const res = await fetchWithTimeout(url)
  if (!res) return []
  try {
    const xml = await res.text()
    const items: Headline[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRegex.exec(xml)) && items.length < limit) {
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
