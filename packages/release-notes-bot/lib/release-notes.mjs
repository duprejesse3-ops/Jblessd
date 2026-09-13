// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

const MODEL = 'claude-sonnet-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You write release notes for two audiences from the same list of merged \
pull requests: a customer-facing changelog entry (what changed, in plain \
language, no PR numbers or internal jargon) and an internal Slack summary \
(can reference PR numbers and authors). Group related PRs together rather \
than listing them one by one. Never invent a change that isn't in the input.

Respond with ONLY a JSON object, no markdown fences:
{
  "version": string,
  "customerChangelog": string,      // markdown, ready to paste into CHANGELOG.md
  "internalSummary": string          // markdown, for Slack — can mention PR numbers/authors
}`

/**
 * @param {string} version    the tag/version this release is
 * @param {Array} prs         from mergedSince()
 * @param {object} [options]
 */
export async function draftReleaseNotes(version, prs, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it as a repo secret and pass it to the workflow step.')
  }

  if (prs.length === 0) {
    return {
      version,
      customerChangelog: `## ${version}\n\nNo user-facing changes in this release.`,
      internalSummary: `${version}: no PRs found in range (first release, or nothing merged).`,
    }
  }

  const input = prs
    .map((pr) => `#${pr.number} "${pr.title}" by ${pr.author}${pr.linearKey ? ` [${pr.linearKey}]` : ''}`)
    .join('\n')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Version: ${version}\n\nMerged pull requests:\n${input}` }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Claude API returned HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Claude API returned no text content.')

  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Could not parse release notes from the model's response: ${text.slice(0, 200)}`)
    return JSON.parse(match[0])
  }
}
