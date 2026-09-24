// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

const MODEL = 'claude-sonnet-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You draw a Mermaid flowchart of a codebase's real structure from a factual \
scan: top-level directories, how many files each has, which directories \
import from which others (with counts), and which infra files exist. Every \
node and edge in your diagram must correspond to something in the input —
do not invent a component, a connection, or a purpose that isn't there. If \
a directory's purpose isn't obvious from its name, label the node with the \
name as-is rather than guessing what it does.

Respond with ONLY a JSON object, no markdown fences:
{
  "mermaid": string,     // a complete \`flowchart TD\` diagram, ready to paste into a \`\`\`mermaid block
  "notes": string        // 2-4 sentences: what the diagram shows, any infra components noted separately
}`

/**
 * @param {object} scan   from scanRepo()
 * @param {object} [options]
 */
export async function draftDiagram(scan, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it as a repo secret and pass it to the workflow step.')
  }

  const input = JSON.stringify(scan, null, 2)

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Repo scan:\n${input}` }],
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
    if (!match) throw new Error(`Could not parse a diagram from the model's response: ${text.slice(0, 200)}`)
    return JSON.parse(match[0])
  }
}
