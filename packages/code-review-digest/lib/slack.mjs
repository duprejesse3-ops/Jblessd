// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

function blocksFor(digest) {
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: 'Code review digest' } },
    { type: 'section', text: { type: 'mrkdwn', text: digest.headline || '' } },
  ]

  if (digest.needsAttention?.length) {
    const lines = digest.needsAttention
      .map((pr) => `• <${pr.url}|#${pr.number} ${pr.title}> — ${pr.author} — _${pr.reason}_`)
      .join('\n')
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Needs attention*\n${lines}` } })
  }

  if (digest.fine?.length) {
    const lines = digest.fine.map((pr) => `• <${pr.url}|#${pr.number} ${pr.title}>`).join('\n')
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Fine to leave*\n${lines}` } })
  }

  return blocks
}

/**
 * @param {object} digest        from draftDigest()
 * @param {string|undefined} webhookUrl
 * @returns {Promise<boolean>}
 */
export async function postToSlack(digest, webhookUrl) {
  if (!webhookUrl) return false
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: digest.headline || 'Code review digest', blocks: blocksFor(digest) }),
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
