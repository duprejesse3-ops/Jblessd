// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Fetches a company's homepage and reduces it to plain text worth handing an
// LLM — no headless browser, no rendering, just the real HTML a plain GET
// returns (which is what most marketing sites serve anyway). A JS-rendered
// single-page app will come back thin; that's a known, accepted limit of a
// zero-dependency fetch, not a bug — the README says so.

const MAX_TEXT_CHARS = 6000

/**
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} html
 * @returns {string|null}
 */
export function extractTitle(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? stripHtml(match[1]) : null
}

function normalizeUrl(input) {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('normalizeUrl requires a non-empty string.')
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * @param {string} domainOrUrl
 * @returns {Promise<{url:string, title:string|null, text:string}>}
 */
export async function fetchSiteText(domainOrUrl) {
  const url = normalizeUrl(domainOrUrl)
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; LeadResearchAgent/1.0)' },
  })
  if (!res.ok) throw new Error(`GET ${url} returned HTTP ${res.status}`)

  const html = await res.text()
  return {
    url,
    title: extractTitle(html),
    text: stripHtml(html).slice(0, MAX_TEXT_CHARS),
  }
}
