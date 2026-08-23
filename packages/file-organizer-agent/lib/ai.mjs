// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional AI fallback for files the rule engine in organize.mjs can't place
// confidently — e.g. "Q3_notes_final_v2.pdf" has no extension or keyword that
// maps cleanly to a category. This is entirely opt-in: the product has zero
// runtime dependencies and works completely without it, exactly like rule
// classification does. It only activates if ANTHROPIC_API_KEY is set, and it
// only ever sends a filename — never file contents — to keep this honest
// about what leaves the buyer's machine.
//
// Implemented as a raw fetch() call rather than the Anthropic SDK so the
// package's dependencies stay at zero — the buyer never has to `npm install`
// anything to run this.

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'
const TIMEOUT_MS = 8000

const CATEGORIES = [
  'Documents', 'Spreadsheets', 'Presentations', 'Images', 'Audio', 'Video',
  'Archives', 'Installers', 'Code', 'Invoices & Receipts', 'Screenshots',
  'Statements', 'Contracts', 'Other',
]

/**
 * Classify a single filename using Claude. Returns a category string from
 * CATEGORIES, or null if the API key is missing, the call fails, or the
 * response doesn't parse — callers should treat null exactly like "the rules
 * couldn't place this either" and fall back to "Other".
 */
export async function classifyWithAI(filename) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 20,
        system:
          `Classify a filename into exactly one category from this list, nothing else: ${CATEGORIES.join(', ')}. ` +
          `Reply with only the category name, exactly as written above.`,
        messages: [{ role: 'user', content: filename }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.content?.find((b) => b.type === 'text')?.text?.trim()
    return CATEGORIES.includes(text) ? text : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
