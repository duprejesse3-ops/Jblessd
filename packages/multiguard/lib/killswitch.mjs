// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole point of the product: one action that sets every registered
// connector's safe mode to read-only at once, instead of opening five
// separate dashboards during an incident. Works generically — it POSTs
// { safeMode: 'read-only' } to every connector's own /api/config, and a
// connector that doesn't have a safeMode concept (MultiWitness, the
// Webhook Bridge) either ignores the unknown field or 404s; either way
// this reports it accurately rather than pretending it worked.

const REQUEST_TIMEOUT_MS = 6_000

/**
 * @typedef {{ id: string, name: string, ok: boolean, message: string }} EngageResult
 */

/**
 * @param {import('./config.mjs').WatchedConnector} connector
 * @returns {Promise<EngageResult>}
 */
async function engageOne(connector) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${connector.baseUrl}/api/config`, {
      method: 'POST',
      headers: { authorization: `Bearer ${connector.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ safeMode: 'read-only' }),
      signal: controller.signal,
    })
    if (res.status === 404) {
      return { id: connector.id, name: connector.name, ok: false, message: 'This connector has no safe-mode concept — nothing to engage.' }
    }
    if (!res.ok) {
      return { id: connector.id, name: connector.name, ok: false, message: `Request failed (HTTP ${res.status}).` }
    }
    return { id: connector.id, name: connector.name, ok: true, message: 'Switched to read-only.' }
  } catch {
    return { id: connector.id, name: connector.name, ok: false, message: 'Unreachable — is it running?' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Engage the kill switch on every registered connector, in parallel. Never
 * throws — a connector that's offline or doesn't support safe mode is
 * reported as such alongside the ones that succeeded, rather than aborting
 * the whole operation.
 * @param {import('./config.mjs').WatchedConnector[]} connectors
 * @returns {Promise<EngageResult[]>}
 */
export async function engageKillSwitch(connectors) {
  return Promise.all(connectors.map(engageOne))
}
