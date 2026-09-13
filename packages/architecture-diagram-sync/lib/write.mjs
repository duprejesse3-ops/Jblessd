// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * @param {string} path       usually 'docs/architecture.md'
 * @param {object} draft      from draftDiagram(): { mermaid, notes }
 * @returns {boolean} true if the file's content actually changed
 */
export function writeDiagram(path, draft) {
  const content =
    `# Architecture\n\n` +
    `_Regenerated automatically from the codebase's real structure — see ` +
    `[architecture-diagram-sync](https://github.com) in this repo's workflows. ` +
    `Do not hand-edit; the next merge to main overwrites this file._\n\n` +
    `${draft.notes}\n\n` +
    '```mermaid\n' +
    draft.mermaid.trim() +
    '\n```\n'

  const previous = existsSync(path) ? readFileSync(path, 'utf8') : null
  if (previous === content) return false

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return true
}
