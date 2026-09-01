// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Talks to a watched connector using nothing but the conventions every
// MultiConnect tool already follows: GET /api/config (Bearer-token gated,
// returns a plain object that MAY include a safeMode field), and GET
// /api/log or GET /api/entries (same auth, returns { entries: [...] }).
// This is what lets MultiGuard work with any connector built the same way
// without hardcoding which product is which.

const REQUEST_TIMEOUT_MS = 6_000

/**
 * @param {string} url
 * @param {string} token
 */
async function getJson(url, token) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal })
    return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : null }
  } catch {
    return { ok: false, status: 0, body: null }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   reachable: boolean,
 *   safeMode: 'read-only' | 'read-write' | null,
 *   recentEntryCount: number
 * }} ProbeResult
 */

/**
 * @param {import('./config.mjs').WatchedConnector} connector
 * @returns {Promise<ProbeResult>}
 */
export async function probeConnector(connector) {
  const configRes = await getJson(`${connector.baseUrl}/api/config`, connector.token)
  if (!configRes.ok) {
    return { id: connector.id, name: connector.name, reachable: false, safeMode: null, recentEntryCount: 0 }
  }

  const safeMode = configRes.body?.safeMode === 'read-only' || configRes.body?.safeMode === 'read-write' ? configRes.body.safeMode : null

  // Try /api/log first (used by 4 of the 5 current MultiConnect tools),
  // fall back to /api/entries (used by MultiWitness) — either way the
  // response shares the same { entries: [...] } envelope by convention.
  let entryCount = 0
  const logRes = await getJson(`${connector.baseUrl}/api/log?limit=50`, connector.token)
  if (logRes.ok && Array.isArray(logRes.body?.entries)) {
    entryCount = logRes.body.entries.length
  } else {
    const entriesRes = await getJson(`${connector.baseUrl}/api/entries?limit=50`, connector.token)
    if (entriesRes.ok && Array.isArray(entriesRes.body?.entries)) entryCount = entriesRes.body.entries.length
  }

  return { id: connector.id, name: connector.name, reachable: true, safeMode, recentEntryCount: entryCount }
}

/**
 * @param {import('./config.mjs').WatchedConnector[]} connectors
 * @returns {Promise<ProbeResult[]>}
 */
export async function probeAll(connectors) {
  return Promise.all(connectors.map(probeConnector))
}
