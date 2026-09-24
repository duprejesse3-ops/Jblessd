// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Posts a drafted postmortem to Slack as a real, readable message — action
// items as a checklist with owners, not a wall of JSON. Uses an incoming
// webhook URL (Slack: your workspace → Apps → Incoming Webhooks), the same
// zero-dependency pattern as site-audit-agent/lib/notify.mjs: silent when no
// webhook is configured, never throws into the caller.

function blocksFor(draft) {
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: draft.title || 'Incident postmortem (draft)' } },
    { type: 'section', text: { type: 'mrkdwn', text: draft.summary || '' } },
  ]

  if (draft.rootCause) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Root cause*\n${draft.rootCause}` } })
  }

  if (draft.timeline?.length) {
    const lines = draft.timeline.slice(0, 15).map((t) => `• \`${t.time}\` — ${t.event}`).join('\n')
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Timeline*\n${lines}` } })
  }

  if (draft.actionItems?.length) {
    const lines = draft.actionItems
      .map((a) => `• [ ] *${a.owner}* — ${a.task}${a.dueBy ? ` _(by ${a.dueBy})_` : ''}`)
      .join('\n')
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Action items*\n${lines}` } })
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Drafted automatically — review before treating this as final.' }],
  })

  return blocks
}

/**
 * @param {object} draft          a draft from draftPostmortem()
 * @param {string|undefined} webhookUrl
 * @returns {Promise<boolean>} true if Slack accepted the message
 */
export async function postToSlack(draft, webhookUrl) {
  if (!webhookUrl) return false
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: draft.title || 'Incident postmortem (draft)', blocks: blocksFor(draft) }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      console.warn(`Slack webhook returned HTTP ${response.status}`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`Slack webhook failed: ${error?.message ?? error}`)
    return false
  }
}
