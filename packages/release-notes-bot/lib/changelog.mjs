// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const HEADER = '# Changelog\n'

/**
 * @param {string} path                 usually 'CHANGELOG.md' at the repo root
 * @param {string} customerChangelog    markdown from draftReleaseNotes(), e.g. "## v1.2.0\n\n- ..."
 * @returns {boolean} true if the file was written
 */
export function prependChangelog(path, customerChangelog) {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : HEADER
  // Keep the top-level "# Changelog" heading first, insert the new entry
  // right after it rather than at the very top of the file.
  const body = existing.startsWith(HEADER) ? existing.slice(HEADER.length) : existing
  const updated = `${HEADER}\n${customerChangelog.trim()}\n${body.trim() ? `\n${body.trim()}\n` : ''}`
  writeFileSync(path, updated)
  return true
}
