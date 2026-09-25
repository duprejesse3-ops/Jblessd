// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Outbound-link extraction — simple regex-based href scraping, no HTML
// parser dependency (same tradeoff the rest of this repo makes: presence and
// resolution of an href is all this needs, not a DOM).

/**
 * Pulls every usable <a href="..."> out of a page. Skips empty hrefs,
 * fragment-only links (#section), and non-navigable schemes.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function extractHrefs(html) {
  const hrefs = []
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1].trim()
    if (!href) continue
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) continue
    hrefs.push(href)
  }
  return hrefs
}

/**
 * Resolves a page's raw hrefs against its own URL and splits them into
 * same-origin (internal) and other-origin (external) links, deduplicated.
 * An unparsable or non-http(s) href is dropped rather than reported —
 * that's a content-authoring problem, not a broken link.
 *
 * @param {string[]} hrefs
 * @param {string} pageUrl
 * @returns {{internal:string[], external:string[]}}
 */
export function classifyLinks(hrefs, pageUrl) {
  const origin = new URL(pageUrl).origin
  const internal = new Set()
  const external = new Set()

  for (const href of hrefs) {
    let resolved
    try {
      resolved = new URL(href, pageUrl)
    } catch {
      continue
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue
    resolved.hash = ''
    if (resolved.origin === origin) internal.add(resolved.href)
    else external.add(resolved.href)
  }

  return { internal: [...internal], external: [...external] }
}

/**
 * Convenience wrapper: extract + classify in one call.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @returns {{internal:string[], external:string[]}}
 */
export function extractLinks(html, pageUrl) {
  return classifyLinks(extractHrefs(html), pageUrl)
}
