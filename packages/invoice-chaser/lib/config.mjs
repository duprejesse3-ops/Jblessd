// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { readFileSync } from 'node:fs'

/**
 * Loads and validates config.json — the escalation ladder: how many days
 * overdue an invoice has to be before it gets a reminder at that tone, and
 * what to call it. Kept as plain JSON (not code) so a non-developer on the
 * team can adjust the schedule without touching the script.
 *
 * @param {string} path
 * @returns {Array<{days:number,label:string,tone?:string}>} sorted ascending by days
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

  if (!Array.isArray(parsed)) throw new Error(`"${path}" must be a JSON array of escalation thresholds.`)
  if (parsed.length === 0) throw new Error(`"${path}" must define at least one escalation threshold.`)

  const thresholds = parsed.map((line, i) => validateLine(line, i, path))

  const seen = new Set()
  for (const t of thresholds) {
    if (seen.has(t.days)) throw new Error(`"${path}" has more than one threshold for day ${t.days}.`)
    seen.add(t.days)
  }

  return thresholds.slice().sort((a, b) => a.days - b.days)
}

function validateLine(line, i, path) {
  const required = ['days', 'label']
  for (const field of required) {
    if (line[field] === undefined || line[field] === null || line[field] === '') {
      throw new Error(`"${path}" entry ${i} is missing required field "${field}".`)
    }
  }
  if (typeof line.days !== 'number' || !Number.isInteger(line.days) || line.days <= 0) {
    throw new Error(`"${path}" entry ${i} (${line.label}): "days" must be a positive integer.`)
  }
  if (typeof line.label !== 'string' || !line.label.trim()) {
    throw new Error(`"${path}" entry ${i}: "label" must be a non-empty string.`)
  }
  return { days: line.days, label: line.label, tone: line.tone ?? 'neutral' }
}
