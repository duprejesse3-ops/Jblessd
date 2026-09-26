// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Splits Claude's numbered-list reply for the social clips prompt back into
// an array of individual clip strings. The blog and newsletter prompts need
// no parsing — their replies are used as-is — so this is the only parser
// this product needs.

/**
 * @param {string} responseText
 * @returns {string[]}
 */
export function parseSocialClips(responseText) {
  const lines = responseText.split('\n')
  const clips = []
  for (const line of lines) {
    const match = /^\s*\d+[.)]\s*(.+)$/.exec(line)
    if (match) clips.push(match[1].trim())
  }
  return clips
}
