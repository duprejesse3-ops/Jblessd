// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A deliberately small CSV reader/writer — this product only ever handles
// its own simple, single-value columns (a domain, a plain enrichment
// string), so a minimal quoted-field parser covers it without pulling in a
// dependency for the general case (embedded commas, newlines in fields).

/**
 * @param {string} text
 * @returns {string[][]}
 */
function parseRows(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { inQuotes = false }
      else { field += char }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field); field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/**
 * @param {string} text
 * @returns {Array<Record<string,string>>}
 */
export function parseCsv(text) {
  const rows = parseRows(text)
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((row) => {
    const record = {}
    header.forEach((key, i) => { record[key] = (row[i] ?? '').trim() })
    return record
  })
}

function escapeField(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/**
 * @param {Array<Record<string,string>>} rows
 * @param {string[]} [columns]  explicit column order; defaults to keys of the first row
 * @returns {string}
 */
export function toCsv(rows, columns) {
  if (rows.length === 0) return ''
  const cols = columns ?? Object.keys(rows[0])
  const lines = [cols.join(',')]
  for (const row of rows) {
    lines.push(cols.map((c) => escapeField(row[c])).join(','))
  }
  return lines.join('\n') + '\n'
}
