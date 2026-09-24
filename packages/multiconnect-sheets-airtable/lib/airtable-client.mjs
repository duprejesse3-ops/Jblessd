// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Thin wrapper over the Airtable REST API — read/create records in a base's
// table. Much simpler than Sheets: a personal access token, no signed JWTs.
// Every write path checks safeMode first, matching every other connector.

const REQUEST_TIMEOUT_MS = 10_000

export class AirtableApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AirtableApiError'
    this.status = status
  }
}

function assertConfigured(config) {
  if (!config.airtable?.apiKey || !config.airtable?.baseId || !config.airtable?.tableName) {
    throw new AirtableApiError('Airtable is not connected yet — set the API key, base ID, and table name first.', 0)
  }
}

function assertWritable(config) {
  if (config.safeMode !== 'read-write') {
    throw new AirtableApiError('Refused: safe mode is read-only. Switch to read-write in the dashboard to allow writes.', 0)
  }
}

/**
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {string} path
 * @param {{ method?: string, body?: unknown, apiBase?: string }} [opts]
 */
async function request(config, path, opts = {}) {
  assertConfigured(config)
  const apiBase = opts.apiBase ?? 'https://api.airtable.com/v0'
  const url = `${apiBase}/${config.airtable.baseId}/${encodeURIComponent(config.airtable.tableName)}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { authorization: `Bearer ${config.airtable.apiKey}`, 'content-type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AirtableApiError(`Airtable API ${res.status}: ${text.slice(0, 300)}`, res.status)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {import('./config.mjs').SheetsConfig} config
 * @returns {Promise<Array<{ id: string, fields: Record<string, unknown> }>>}
 */
export async function listRecords(config, opts = {}) {
  const data = await request(config, '?pageSize=100', opts)
  return data.records ?? []
}

/**
 * Create one record. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {Record<string, unknown>} fields
 */
export async function createRecord(config, fields, opts = {}) {
  assertWritable(config)
  const data = await request(config, '', { ...opts, method: 'POST', body: { fields } })
  return data
}
