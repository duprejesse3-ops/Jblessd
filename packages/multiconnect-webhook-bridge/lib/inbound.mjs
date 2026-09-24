// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The other half of the bridge: Zapier/Make calling *in* to kick off an agent
// task. This module validates and maps the incoming payload; server.mjs owns
// the actual HTTP route and decides where the mapped result goes next (a
// local file queue by default — see server.mjs's AGENT_INBOX_PATH).

import { applyMapping } from './mapping.mjs'
import { record } from './log.mjs'

const MAX_BODY_BYTES = 1_000_000 // 1MB — generous for a webhook payload, small enough to bound abuse

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    /** @type {Buffer[]} */
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Map an inbound payload using the customer's saved inbound rules, and log
 * the event for the dashboard's test console.
 * @param {import('./config.mjs').BridgeConfig} config
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown>}
 */
export function handleInbound(config, rawPayload) {
  const mapped = applyMapping(rawPayload, config.inboundMappings)
  record({
    direction: 'inbound',
    status: 'ok',
    statusCode: 200,
    summary: 'Received inbound webhook',
    detail: JSON.stringify(mapped),
  })
  return mapped
}
