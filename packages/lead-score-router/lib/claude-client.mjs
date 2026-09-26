// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Thin wrapper over Claude's Messages API via plain `fetch` — zero
// dependencies, same pattern as every other MultiNicheAI automation that
// calls an LLM (see lead-research-agent's lib/claude-client.mjs, which this
// mirrors exactly).

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-5'

/**
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.apiKey]  defaults to ANTHROPIC_API_KEY
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @returns {Promise<string>} the model's text reply
 */
export async function callClaude(prompt, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')
  if (!prompt || !prompt.trim()) throw new Error('callClaude requires a non-empty prompt.')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? 512,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic API returned HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  if (!text) throw new Error('Anthropic API returned no text content.')
  return text
}
