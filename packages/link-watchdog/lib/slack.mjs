// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional run summary, so you don't have to open the email to know the job
// ran and what it found. A no-op if SLACK_WEBHOOK_URL isn't set.

import { buildSummaryText } from './report.mjs'

/**
 * @param {object} report  from buildReport()
 * @param {string|undefined} webhookUrl
 * @returns {Promise<boolean>}
 */
export async function postSummary(report, webhookUrl) {
  if (!webhookUrl) return false

  const text = `Link watchdog ran — ${buildSummaryText(report)}`

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`Slack webhook returned HTTP ${res.status}`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`Slack webhook failed: ${error?.message ?? error}`)
    return false
  }
}
