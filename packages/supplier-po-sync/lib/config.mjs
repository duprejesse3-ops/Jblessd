// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { readFileSync } from 'node:fs'

/**
 * Loads and validates config.json — the list of SKUs this product watches,
 * their reorder threshold/quantity, and which supplier gets the PO. Kept as
 * plain JSON (not code) so a non-developer on the team can maintain it.
 *
 * @param {string} path
 * @returns {Array<{sku:string,name:string,threshold:number,reorderQty:number,
 *   unitCost?:number,supplierName:string,supplierEmail:string}>}
 */
export function loadConfig(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(`Could not read config file at "${path}": ${err.message}`)
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`"${path}" is not valid JSON: ${err.message}`)
  }

  if (!Array.isArray(parsed)) throw new Error(`"${path}" must be a JSON array of SKU configs.`)

  return parsed.map((line, i) => validateLine(line, i, path))
}

function validateLine(line, i, path) {
  const required = ['sku', 'name', 'threshold', 'reorderQty', 'supplierName', 'supplierEmail']
  for (const field of required) {
    if (line[field] === undefined || line[field] === null || line[field] === '') {
      throw new Error(`"${path}" entry ${i} is missing required field "${field}".`)
    }
  }
  if (typeof line.threshold !== 'number' || line.threshold <= 0) {
    throw new Error(`"${path}" entry ${i} (${line.sku}): "threshold" must be a positive number.`)
  }
  if (typeof line.reorderQty !== 'number' || line.reorderQty <= 0) {
    throw new Error(`"${path}" entry ${i} (${line.sku}): "reorderQty" must be a positive number.`)
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(line.supplierEmail)) {
    throw new Error(`"${path}" entry ${i} (${line.sku}): "supplierEmail" doesn't look like a valid email.`)
  }
  return line
}
