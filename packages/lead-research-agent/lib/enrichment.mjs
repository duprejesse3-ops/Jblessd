// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a fetched site's text into an enrichment prompt, and turns Claude's
// reply back into structured fields. Asks for a fixed, labeled-line format
// (not JSON) because a small model reproduces "Label: value" lines far more
// reliably than well-formed JSON, and a labeled line degrades gracefully —
// a missing field just parses to null instead of breaking the whole record.

/**
 * @param {{url:string, title:string|null, text:string}} site
 * @returns {string}
 */
export function buildEnrichmentPrompt(site) {
  return [
    'You are researching a company from its own homepage text, for a sales team building a lead list.',
    `Company site: ${site.url}`,
    site.title ? `Page title: ${site.title}` : null,
    '',
    'Homepage text (may be partial or thin if the site is JS-rendered):',
    '"""',
    site.text || '(no readable text extracted)',
    '"""',
    '',
    'Reply with exactly these four labeled lines and nothing else. If you genuinely cannot',
    'tell from the text, write "unknown" for that line rather than guessing.',
    'Industry: <a short industry/category guess, e.g. "B2B SaaS - marketing analytics">',
    'Size signal: <any evidence of company size, e.g. "mentions 50-person team" or "unknown">',
    'Value prop: <one sentence, what this company sells or does>',
    'Contact page: <a contact/about/team page URL if you can infer one from the text, else "unknown">',
  ].filter(Boolean).join('\n')
}

const LABELS = [
  ['industry', /^industry:\s*(.+)$/im],
  ['sizeSignal', /^size signal:\s*(.+)$/im],
  ['valueProp', /^value prop:\s*(.+)$/im],
  ['contactPageGuess', /^contact page:\s*(.+)$/im],
]

/**
 * @param {string} responseText
 * @returns {{industry:string|null, sizeSignal:string|null, valueProp:string|null, contactPageGuess:string|null}}
 */
export function parseEnrichmentResponse(responseText) {
  const result = {}
  for (const [field, pattern] of LABELS) {
    const match = pattern.exec(responseText)
    const value = match ? match[1].trim() : null
    result[field] = value && value.toLowerCase() !== 'unknown' ? value : null
  }
  return result
}
