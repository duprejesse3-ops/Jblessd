// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

const MODEL = 'claude-sonnet-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You write short, direct code-review digests for a Slack channel. Given a \
list of open pull requests (title, author, age, last-updated, draft status, \
latest review state), produce a digest that:
- Leads with what actually needs a human today (stale, unreviewed, or
  changes-requested-and-not-addressed PRs) — not a flat list in PR-number order.
- Is honest when nothing is urgent — say so in one line, don't pad it.
- Never invents information not present in the input.

Respond with ONLY a JSON object, no markdown fences:
{
  "headline": string,               // one line, e.g. "3 PRs need attention, 2 are fine to leave"
  "needsAttention": [{ "number": number, "title": string, "author": string, "reason": string, "url": string }],
  "fine": [{ "number": number, "title": string, "url": string }]
}`

/**
 * @param {Array} prs   from listOpenPRs()
 * @param {object} [options]
 * @param {string} [options.apiKey]  defaults to ANTHROPIC_API_KEY
 */
export async function draftDigest(prs, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it as a repo secret and pass it to the workflow step.')
  }

  if (prs.length === 0) {
    return { headline: 'No open pull requests.', needsAttention: [], fine: [] }
  }

  const input = prs
    .map(
      (pr) =>
        `#${pr.number} "${pr.title}" by ${pr.author} — opened ${pr.ageDays}d ago, updated ${pr.updatedDaysAgo}d ago, ` +
        `${pr.draft ? 'draft, ' : ''}latest review: ${pr.reviewDecision ?? 'none'}`,
    )
    .join('\n')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Open pull requests:\n${input}` }],
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
    if (!match) throw new Error(`Could not parse a digest from the model's response: ${text.slice(0, 200)}`)
    return JSON.parse(match[0])
  }
}
