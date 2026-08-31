// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two halves: posting to a Slack Incoming Webhook (outbound), and verifying
// the signature Slack attaches to slash-command/event requests (inbound).
// Slack's signing scheme: HMAC-SHA256 of "v0:{timestamp}:{raw body}" using
// the app's signing secret, compared against the X-Slack-Signature header.
// See https://api.slack.com/authentication/verifying-requests-from-slack.

import { createHmac, timingSafeEqual } from 'node:crypto'

const REQUEST_TIMEOUT_MS = 10_000
// Slack recommends rejecting anything older than 5 minutes, to block replay
// of a captured request.
const MAX_TIMESTAMP_SKEW_SEC = 60 * 5

export class SlackApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'SlackApiError'
    this.status = status
  }
}

/**
 * Post a message to a Slack Incoming Webhook URL.
 * @param {string} webhookUrl
 * @param {string} text
 */
export async function postToSlack(webhookUrl, text) {
  if (!webhookUrl) throw new SlackApiError('No Slack webhook URL configured for this route.', 0)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new SlackApiError(`Slack webhook ${res.status}: ${body.slice(0, 300)}`, res.status)
    }
    return { ok: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verify a Slack request signature.
 * @param {string} rawBody the exact, unparsed request body
 * @param {string} timestampHeader the X-Slack-Request-Timestamp header
 * @param {string} signatureHeader the X-Slack-Signature header
 * @param {string} signingSecret
 * @param {number} [now] unix seconds, injectable for tests
 */
export function verifySlackSignature(rawBody, timestampHeader, signatureHeader, signingSecret, now = Math.floor(Date.now() / 1000)) {
  if (!signingSecret || !timestampHeader || !signatureHeader) return false
  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_SKEW_SEC) return false

  const base = `v0:${timestampHeader}:${rawBody}`
  const computed = 'v0=' + createHmac('sha256', signingSecret).update(base, 'utf8').digest('hex')
  const a = Buffer.from(computed)
  const b = Buffer.from(signatureHeader)
  return a.length === b.length && timingSafeEqual(a, b)
}
