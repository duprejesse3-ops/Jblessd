// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a supplier's grouped low-stock items into an actual purchase order:
// a real CSV attachment (opens in Excel/Sheets/anything) plus the plain-text
// body of the email that sends it. No PDF library, no templating engine —
// a PO is a table and a few lines of text, and keeping this dependency-free
// means it has nothing to break on an update.

function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * @param {string} poNumber
 * @param {Array<{sku:string,name:string,available:number,reorderQty:number,unitCost?:number}>} items
 * @returns {string} CSV text
 */
export function buildPoCsv(poNumber, items) {
  const rows = [['PO Number', 'SKU', 'Item', 'Currently in stock', 'Qty ordered', 'Unit cost', 'Line total']]
  let total = 0
  for (const item of items) {
    const unitCost = Number(item.unitCost ?? 0)
    const lineTotal = unitCost * item.reorderQty
    total += lineTotal
    rows.push([
      poNumber,
      item.sku,
      item.name,
      item.available,
      item.reorderQty,
      unitCost ? unitCost.toFixed(2) : '',
      unitCost ? lineTotal.toFixed(2) : '',
    ])
  }
  if (items.some((i) => i.unitCost)) {
    rows.push(['', '', '', '', '', 'Total', total.toFixed(2)])
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

/**
 * @param {string} poNumber
 * @param {string} supplierName
 * @param {Array<{sku:string,name:string,available:number,reorderQty:number,unitCost?:number}>} items
 * @param {string} [storeName]
 * @returns {string} plain-text email body
 */
export function buildPoEmailBody(poNumber, supplierName, items, storeName) {
  const lines = [
    `Purchase order ${poNumber}`,
    storeName ? `From: ${storeName}` : null,
    `To: ${supplierName}`,
    '',
    'The following items have reached their reorder point and need restocking:',
    '',
  ].filter(Boolean)

  for (const item of items) {
    lines.push(`  - ${item.name} (${item.sku}): ${item.reorderQty} units — currently ${item.available} in stock`)
  }

  lines.push('')
  lines.push('Full line-item detail, including unit cost where configured, is attached as a CSV.')
  lines.push('')
  lines.push('This PO was generated automatically because stock crossed the reorder threshold configured for these items — please confirm receipt and expected delivery date.')

  return lines.join('\n')
}

/**
 * @param {number} n  a running counter (e.g. count of POs sent so far), used
 *   only to keep same-day PO numbers distinct — persistence is the caller's
 *   choice (a file, a database row, or just accept collisions are harmless
 *   since the CSV attachment is still fully correct either way).
 * @param {Date} [now]
 */
export function generatePoNumber(n = 0, now = new Date()) {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const seq = String(n).padStart(3, '0')
  return `PO-${y}${m}${d}-${seq}`
}
