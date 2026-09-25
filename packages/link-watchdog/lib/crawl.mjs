// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional step: look at the pages the sitemap already told us are OK, pull
// their outbound (off-site) links, and hand back a deduplicated, capped list
// for the checker to test. Kept separate from bin/watchdog.mjs so it has its
// own tests with a fake fetchFn — no real page is ever fetched in the suite.

import { extractLinks } from './links.mjs'

/**
 * Scans `pages` (URLs already known to have responded 2xx) for outbound
 * links, stopping as soon as `limit` distinct external links have been
 * found. A link's "found on" page is the first page it was seen on.
 *
 * @param {string[]} pages
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn]
 * @param {number} [options.timeoutMs=8000]
 * @param {string} [options.userAgent]
 * @param {number} [options.limit=20]
 * @returns {Promise<Array<{url:string, foundOn:string}>>}
 */
export async function discoverExternalLinks(
  pages,
  { fetchFn = fetch, timeoutMs = 8000, userAgent = 'link-watchdog/1.0', limit = 20 } = {},
) {
  const found = new Map() // external URL -> the page it was first seen on

  if (limit <= 0) return []

  for (const page of pages) {
    if (found.size >= limit) break

    let html
    try {
      const res = await fetchFn(page, {
        method: 'GET',
        headers: { 'user-agent': userAgent, accept: 'text/html' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) continue
      const contentType = res.headers.get?.('content-type') ?? ''
      if (contentType && !contentType.includes('text/html')) continue
      html = await res.text()
    } catch {
      // A page that fails here was already recorded as broken by the main
      // sitemap check (or wasn't — either way, link discovery just skips it).
      continue
    }

    const { external } = extractLinks(html, page)
    for (const link of external) {
      if (found.size >= limit) break
      if (!found.has(link)) found.set(link, page)
    }
  }

  return [...found.entries()].map(([url, foundOn]) => ({ url, foundOn }))
}
