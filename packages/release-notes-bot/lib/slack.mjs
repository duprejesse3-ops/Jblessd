// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

function blocksFor(notes) {
  return [
    { type: 'header', text: { type: 'plain_text', text: `Release ${notes.version}` } },
    { type: 'section', text: { type: 'mrkdwn', text: notes.internalSummary || notes.customerChangelog || '' } },
  ]
}

/**
 * @param {object} notes         from draftReleaseNotes()
 * @param {string|undefined} webhookUrl
 * @returns {Promise<boolean>}
 */
export async function postToSlack(notes, webhookUrl) {
  if (!webhookUrl) return false
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `Release ${notes.version}`, blocks: blocksFor(notes) }),
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
