// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A small, dependency-free .ics (iCalendar) parser — just enough of RFC 5545
// to pull events out of a calendar export. Not a full implementation (no
// recurrence-rule expansion, no timezone database) — v1 reads whatever
// concrete events are already in the file, which is what most calendar apps
// write when you export or auto-sync a .ics.
//
// Deliberately local-file only. This reads a file the user already has on
// disk (their calendar app's own export/auto-sync feature writes it) rather
// than talking to a Google/Outlook/etc. API — no OAuth app to register, no
// token to store, no third-party account access at all. See README for how
// to get your calendar app to keep that file updated.

import { readFileSync, existsSync } from 'node:fs'

function unfold(text) {
  // RFC 5545 line folding: a continuation line starts with a space or tab.
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function unescapeText(value) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseDate(value) {
  // Handles the two common forms: YYYYMMDD (all-day) and
  // YYYYMMDDTHHMMSS[Z] (timed). Returns an ISO string, or the raw value if
  // it doesn't match either — better to pass through an odd value than drop
  // the event.
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/)
  if (!m) return value
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`
  return iso
}

/**
 * Parse .ics text into a flat array of events:
 *   { summary, start, end, location, description }
 * Any field not present in the source is omitted.
 */
export function parseIcs(icsText) {
  const lines = unfold(icsText).split('\n')
  const events = []
  let current = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current && (current.summary || current.start)) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1)
    const key = rawKey.split(';')[0].toUpperCase() // strip parameters like ;TZID=...

    if (key === 'SUMMARY') current.summary = unescapeText(value)
    else if (key === 'DTSTART') current.start = parseDate(value)
    else if (key === 'DTEND') current.end = parseDate(value)
    else if (key === 'LOCATION') current.location = unescapeText(value)
    else if (key === 'DESCRIPTION') current.description = unescapeText(value)
  }

  return events
}

/**
 * Read and parse a .ics file. Returns [] (not an error) if the path doesn't
 * exist — a calendar file is optional for MultiVault, and a missing one
 * should degrade the context, not fail the sync.
 */
export function readIcsFile(path) {
  if (!path || !existsSync(path)) return []
  try {
    return parseIcs(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}
