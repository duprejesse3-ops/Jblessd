// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Sends a mapped payload out to the customer's configured Zapier ("Webhooks
// by Zapier") or Make webhook URL, with a small bounded retry — this is the
// "outbound triggers" half of the bridge: the agent's own actions firing
// into whatever Zap or Scenario the customer built.

import { applyMapping } from './mapping.mjs'
import { record } from './log.mjs'

const RETRY_DELAYS_MS = [500, 2000, 5000]
const REQUEST_TIMEOUT_MS = 10_000

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
async function attempt(url, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    return { ok: res.ok, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Map and send an event out to the customer's configured webhook. Logs every
 * attempt (visible in the dashboard's test console) and retries transient
 * failures a bounded number of times before giving up.
 * @param {import('./config.mjs').BridgeConfig} config
 * @param {unknown} rawPayload
 * @returns {Promise<{ ok: boolean, status: number | null }>}
 */
export async function sendOutbound(config, rawPayload) {
  if (!config.outboundUrl) {
    record({
      direction: 'outbound',
      status: 'error',
      statusCode: null,
      summary: 'No outbound webhook URL configured',
      detail: 'Set one in the dashboard before triggering agent events.',
    })
    return { ok: false, status: null }
  }

  const mapped = applyMapping(rawPayload, config.outboundMappings)
  let lastStatus = null

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      const res = await attempt(config.outboundUrl, mapped)
      lastStatus = res.status
      if (res.ok) {
        record({
          direction: 'outbound',
          status: 'ok',
          statusCode: res.status,
          summary: `Sent to ${new URL(config.outboundUrl).hostname}`,
          detail: JSON.stringify(mapped),
        })
        return { ok: true, status: res.status }
      }
      // A 4xx is the receiving end rejecting the payload shape — retrying
      // won't fix that, so only 5xx/network errors get the retry budget.
      if (res.status < 500) break
    } catch (err) {
      lastStatus = null
      if (i === RETRY_DELAYS_MS.length) {
        record({
          direction: 'outbound',
          status: 'error',
          statusCode: null,
          summary: 'Outbound send failed after retries',
          detail: /** @type {Error} */ (err).message,
        })
      }
    }
    if (i < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[i])
  }

  record({
    direction: 'outbound',
    status: 'error',
    statusCode: lastStatus,
    summary: 'Outbound send failed',
    detail: JSON.stringify(mapped),
  })
  return { ok: false, status: lastStatus }
}
