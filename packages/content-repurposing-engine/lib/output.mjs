// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Writes the three generated pieces to their own files in an output
// directory — one file per format, so each can be copied straight into a
// CMS, an email tool, or a social scheduler without editing the others out
// of a single combined document.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {string} outDir
 * @param {object} pieces
 * @param {string} pieces.blogMarkdown
 * @param {string} pieces.newsletterText
 * @param {string[]} pieces.socialClips
 * @returns {{blogPath:string, newsletterPath:string, clipsPath:string}}
 */
export function writeOutputs(outDir, { blogMarkdown, newsletterText, socialClips }) {
  mkdirSync(outDir, { recursive: true })

  const blogPath = join(outDir, 'blog-post.md')
  const newsletterPath = join(outDir, 'newsletter.md')
  const clipsPath = join(outDir, 'social-clips.md')

  writeFileSync(blogPath, blogMarkdown.trim() + '\n')
  writeFileSync(newsletterPath, newsletterText.trim() + '\n')
  writeFileSync(
    clipsPath,
    ['# Social clips', '', ...socialClips.map((clip, i) => `${i + 1}. ${clip}`), ''].join('\n'),
  )

  return { blogPath, newsletterPath, clipsPath }
}
