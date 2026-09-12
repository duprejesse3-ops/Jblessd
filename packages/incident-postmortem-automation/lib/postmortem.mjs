// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The actual automation, not a prompt to paste somewhere: given a timeline of
// what happened during an incident, this calls Claude once and returns a
// structured, blameless postmortem draft — root cause, impact, and action
// items with an owner already assigned to each one, not just a paragraph you
// still have to turn into tickets yourself.

const MODEL = 'claude-sonnet-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You write blameless incident postmortems. Blameless means: describe what \
the system and process allowed to happen, never "who caused it." Every action \
item must have a concrete owner (a role or team, e.g. "on-call engineer", \
"platform team" — a real name if one appears in the timeline) and be phrased \
as a specific, checkable task, not "improve monitoring."

Respond with ONLY a JSON object, no markdown fences, no commentary, matching \
exactly this shape:
{
  "title": string,
  "summary": string,           // 2-3 sentences, what happened and impact
  "timeline": [{ "time": string, "event": string }],
  "rootCause": string,
  "actionItems": [{ "owner": string, "task": string, "dueBy": string }]
}`

/**
 * @param {string} timelineText   raw incident timeline — paste from PagerDuty,
 *   a Slack thread export, or plain notes. No fixed format required.
 * @param {object} [options]
 * @param {string} [options.incidentTitle]
 * @param {string} [options.apiKey]  defaults to ANTHROPIC_API_KEY
 * @returns {Promise<{title:string, summary:string, timeline:Array, rootCause:string, actionItems:Array}>}
 */
export async function draftPostmortem(timelineText, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Get one at console.anthropic.com and put it in .env — ' +
        'this is your own key, billed to your own account, never shared with the seller.',
    )
  }
  if (!timelineText || !timelineText.trim()) {
    throw new Error('No timeline text given — nothing to draft a postmortem from.')
  }

  const userMessage = options.incidentTitle
    ? `Incident: ${options.incidentTitle}\n\nTimeline:\n${timelineText}`
    : `Timeline:\n${timelineText}`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
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

  let draft
  try {
    draft = JSON.parse(text)
  } catch {
    // Models occasionally wrap JSON in a fence despite instructions not to.
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Could not parse a postmortem draft from the model's response: ${text.slice(0, 200)}`)
    draft = JSON.parse(match[0])
  }

  if (!Array.isArray(draft.actionItems)) draft.actionItems = []
  if (!Array.isArray(draft.timeline)) draft.timeline = []
  return draft
}
