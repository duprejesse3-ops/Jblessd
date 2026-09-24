// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Thin wrapper over the Google Sheets API v4 — read/write rows as arrays of
// plain values, keyed by A1-style ranges. Every write path checks safeMode
// first, matching every other connector in this line.

import { getAccessToken } from './google-auth.mjs'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const REQUEST_TIMEOUT_MS = 10_000

export class SheetsApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'SheetsApiError'
    this.status = status
  }
}

function assertConfigured(config) {
  if (!config.sheets?.serviceAccountEmail || !config.sheets?.privateKey || !config.sheets?.spreadsheetId) {
    throw new SheetsApiError('Google Sheets is not connected yet — set the service account and spreadsheet ID first.', 0)
  }
}

function assertWritable(config) {
  if (config.safeMode !== 'read-write') {
    throw new SheetsApiError('Refused: safe mode is read-only. Switch to read-write in the dashboard to allow writes.', 0)
  }
}

/**
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {string} path
 * @param {{ method?: string, body?: unknown, apiBase?: string, tokenFn?: typeof getAccessToken }} [opts]
 */
async function request(config, path, opts = {}) {
  assertConfigured(config)
  const tokenFn = opts.tokenFn ?? getAccessToken
  const { accessToken } = await tokenFn(config.sheets.serviceAccountEmail, config.sheets.privateKey)
  const apiBase = opts.apiBase ?? SHEETS_API
  const url = `${apiBase}/${config.sheets.spreadsheetId}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new SheetsApiError(`Sheets API ${res.status}: ${text.slice(0, 300)}`, res.status)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read all rows from the configured sheet, first row treated as headers.
 * @param {import('./config.mjs').SheetsConfig} config
 * @returns {Promise<{ headers: string[], rows: Record<string, string>[] }>}
 */
export async function readRows(config, opts = {}) {
  const range = `${config.sheets.sheetName}!A1:ZZ1000`
  const data = await request(config, `/values/${encodeURIComponent(range)}`, opts)
  const values = data.values ?? []
  if (values.length === 0) return { headers: [], rows: [] }
  const [headers, ...body] = values
  const rows = body.map((row) => {
    /** @type {Record<string, string>} */
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

/**
 * Append one row to the end of the sheet. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {string[]} headers the sheet's current header row, to order values correctly
 * @param {Record<string, string>} rowObject
 */
export async function appendRow(config, headers, rowObject, opts = {}) {
  assertWritable(config)
  const values = [headers.map((h) => rowObject[h] ?? '')]
  const range = `${config.sheets.sheetName}!A1`
  const data = await request(
    config,
    `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { ...opts, method: 'POST', body: { values } },
  )
  return data
}
