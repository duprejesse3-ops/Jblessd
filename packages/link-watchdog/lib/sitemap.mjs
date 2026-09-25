// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Sitemap XML parsing — plain regex, no XML parser dependency. A sitemap.xml
// (and a sitemap index, which lists other sitemaps instead of pages) is a
// handful of flat <loc> tags; a real parser is overkill and would break the
// zero-dependency rule the rest of this package follows.

/**
 * Pulls every <loc> out of a sitemap document and says whether it was a
 * <sitemapindex> (a list of other sitemaps) or a <urlset> (a list of pages).
 *
 * @param {string} xml
 * @returns {{ type: 'sitemapindex' | 'urlset', locs: string[] }}
 */
export function parseSitemapXml(xml) {
  const type = /<sitemapindex\b/i.test(xml) ? 'sitemapindex' : 'urlset'
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim()).filter(Boolean)
  return { type, locs }
}

/**
 * Resolves a sitemap URL to the full flat list of page URLs it (transitively)
 * lists, following a sitemap index up to `maxSitemaps` documents deep so a
 * large site's split sitemaps (sitemap-1.xml, sitemap-2.xml, ...) are all
 * read, not just the index itself.
 *
 * @param {string} sitemapUrl
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn]  injectable for testing — no
 *   network call happens in the test suite
 * @param {number} [options.timeoutMs=8000]
 * @param {string} [options.userAgent]
 * @param {number} [options.maxSitemaps=20]  caps how many sitemap *documents*
 *   (not pages) this will fetch, so a malformed/cyclical index can't loop
 *   forever
 * @returns {Promise<string[]>} deduplicated page URLs
 */
export async function fetchSitemapUrls(
  sitemapUrl,
  { fetchFn = fetch, timeoutMs = 8000, userAgent = 'link-watchdog/1.0', maxSitemaps = 20 } = {},
) {
  const seenSitemaps = new Set()
  const queue = [sitemapUrl]
  const urls = new Set()
  let fetched = 0

  while (queue.length && fetched < maxSitemaps) {
    const next = queue.shift()
    if (seenSitemaps.has(next)) continue
    seenSitemaps.add(next)
    fetched += 1

    const res = await fetchFn(next, {
      headers: { 'user-agent': userAgent, accept: 'application/xml,text/xml' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      throw new Error(`Could not fetch sitemap "${next}": HTTP ${res.status}`)
    }
    const xml = await res.text()
    const { type, locs } = parseSitemapXml(xml)

    if (type === 'sitemapindex') {
      for (const loc of locs) queue.push(loc)
    } else {
      for (const loc of locs) urls.add(loc)
    }
  }

  return [...urls]
}
