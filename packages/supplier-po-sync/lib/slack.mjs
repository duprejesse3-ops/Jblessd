// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional run summary, so you don't have to check your inbox/logs to know
// the job ran and what it did. A no-op if SLACK_WEBHOOK_URL isn't set.

/**
 * @param {Array<{poNumber:string, supplierName:string, itemCount:number, sent:boolean}>} results
 * @param {string|undefined} webhookUrl
 * @returns {Promise<boolean>}
 */
export async function postSummary(results, webhookUrl) {
  if (!webhookUrl) return false

  const text = results.length
    ? `Supplier PO sync ran — ${results.length} PO(s) generated:\n` +
      results.map((r) => `• ${r.poNumber} — ${r.supplierName} (${r.itemCount} item${r.itemCount === 1 ? '' : 's'})${r.sent ? '' : ' — NOT sent (dry run / no email key)'}`).join('\n')
    : 'Supplier PO sync ran — nothing at or below its reorder threshold. No POs needed.'

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
