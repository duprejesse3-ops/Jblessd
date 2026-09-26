#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point: reads a transcript (plain text — export it from your
// podcast host, video platform, or transcription tool first; this script
// does not transcribe audio itself), and calls Claude three times to
// produce a blog post draft, a newsletter blurb, and a set of short social
// clips — writing each to its own file in the output directory.

import { readFileSync } from 'node:fs'
import { buildBlogPrompt, buildNewsletterPrompt, buildSocialClipsPrompt } from '../lib/prompts.mjs'
import { parseSocialClips } from '../lib/parse.mjs'
import { callClaude } from '../lib/claude-client.mjs'
import { writeOutputs } from '../lib/output.mjs'

async function main() {
  const transcriptPath = process.env.REPURPOSE_TRANSCRIPT ?? new URL('../transcript.txt', import.meta.url).pathname
  const outDir = process.env.REPURPOSE_OUTPUT_DIR ?? new URL('../output', import.meta.url).pathname
  const title = process.env.REPURPOSE_TITLE
  const clipCount = Number(process.env.REPURPOSE_CLIP_COUNT ?? 5)

  const transcript = readFileSync(transcriptPath, 'utf8')
  if (!transcript.trim()) throw new Error(`"${transcriptPath}" is empty — nothing to repurpose.`)

  console.log('Writing blog post draft...')
  const blogMarkdown = await callClaude(buildBlogPrompt(transcript, title), { maxTokens: 4096 })

  console.log('Writing newsletter blurb...')
  const newsletterText = await callClaude(buildNewsletterPrompt(transcript, title), { maxTokens: 512 })

  console.log(`Pulling ${clipCount} social clips...`)
  const clipsReply = await callClaude(buildSocialClipsPrompt(transcript, clipCount), { maxTokens: 1024 })
  const socialClips = parseSocialClips(clipsReply)

  const paths = writeOutputs(outDir, { blogMarkdown, newsletterText, socialClips })

  console.log(`\nDone. Wrote:\n  ${paths.blogPath}\n  ${paths.newsletterPath}\n  ${paths.clipsPath}`)
  if (socialClips.length === 0) {
    console.warn('\nWarning: could not parse any numbered clips out of the model\'s reply — check social-clips.md, it may need a manual look.')
  }
}

main().catch((err) => {
  console.error(`content-repurposing-engine failed: ${err.message}`)
  process.exitCode = 1
})
