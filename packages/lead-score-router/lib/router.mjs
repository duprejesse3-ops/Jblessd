// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Formats and posts the routing notification for a scored lead. A no-op
// (returns false) when a tier has no webhookUrl configured, so a "logged
// only, no Slack" tier is a normal, deliberate config rather than an error.

/**
 * @param {object} args
 * @param {object} args.lead
 * @param {{score:number, reason:string}} args.scoreResult
 * @param {{name:string, minScore:number}} args.tier
 * @returns {string}
 */
export function buildRoutingMessage({ lead, scoreResult, tier }) {
  const identity = lead.name || lead.email || lead.company || 'A new lead'
  const lines = [
    `*${tier.name}* (score ${scoreResult.score}/100) — ${identity}`,
    scoreResult.reason ? `_${scoreResult.reason}_` : null,
  ]
  for (const [key, value] of Object.entries(lead)) {
    if (!value || String(value).trim() === '') continue
    lines.push(`• ${key}: ${value}`)
  }
  return lines.filter(Boolean).join('\n')
}

/**
 * @param {string} webhookUrl
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function postToSlack(webhookUrl, text) {
  if (!webhookUrl) return false

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
