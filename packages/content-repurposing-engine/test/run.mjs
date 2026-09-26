// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { buildBlogPrompt, buildNewsletterPrompt, buildSocialClipsPrompt } from '../lib/prompts.mjs'
import { parseSocialClips } from '../lib/parse.mjs'
import { writeOutputs } from '../lib/output.mjs'

let failures = 0
async function test(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.error(`not ok - ${name}`)
    console.error(`  ${err.message}`)
  }
}

const SAMPLE_TRANSCRIPT = 'Host: Welcome back. Today we talk about how we cut onboarding time from six weeks to four days by rewriting our docs.'

// ---- prompts ------------------------------------------------------------------

await test('buildBlogPrompt: includes the transcript and title', () => {
  const prompt = buildBlogPrompt(SAMPLE_TRANSCRIPT, 'Cutting Onboarding Time')
  assert.match(prompt, /Cutting Onboarding Time/)
  assert.match(prompt, /six weeks to four days/)
})

await test('buildBlogPrompt: omits the title line when none is given', () => {
  const prompt = buildBlogPrompt(SAMPLE_TRANSCRIPT)
  assert.ok(!prompt.includes('Working title:'))
})

await test('buildBlogPrompt: truncates an overly long transcript', () => {
  const long = 'x'.repeat(50_000)
  const prompt = buildBlogPrompt(long)
  assert.match(prompt, /\[transcript truncated\]/)
})

await test('buildNewsletterPrompt: includes the transcript and asks for a word count range', () => {
  const prompt = buildNewsletterPrompt(SAMPLE_TRANSCRIPT, 'Ep 12')
  assert.match(prompt, /Ep 12/)
  assert.match(prompt, /120-180 words/)
})

await test('buildSocialClipsPrompt: asks for the requested number of numbered lines', () => {
  const prompt = buildSocialClipsPrompt(SAMPLE_TRANSCRIPT, 3)
  assert.match(prompt, /exactly 3 numbered lines/)
  assert.match(prompt, /"1\." through "3\."/)
})

await test('buildSocialClipsPrompt: defaults to 5 clips', () => {
  const prompt = buildSocialClipsPrompt(SAMPLE_TRANSCRIPT)
  assert.match(prompt, /exactly 5 numbered lines/)
})

// ---- parse ----------------------------------------------------------------------

await test('parseSocialClips: extracts numbered lines into an array', () => {
  const reply = '1. First clip here.\n2. Second clip here.\n3. Third clip here.'
  assert.deepEqual(parseSocialClips(reply), ['First clip here.', 'Second clip here.', 'Third clip here.'])
})

await test('parseSocialClips: tolerates a ")" delimiter and surrounding blank lines', () => {
  const reply = '\n1) First.\n\n2) Second.\n'
  assert.deepEqual(parseSocialClips(reply), ['First.', 'Second.'])
})

await test('parseSocialClips: returns [] when the reply has no numbered lines', () => {
  assert.deepEqual(parseSocialClips('Sorry, I could not find any quotable moments.'), [])
})

// ---- output -----------------------------------------------------------------------

await test('writeOutputs: writes all three files with expected content', () => {
  const outDir = new URL('./tmp-output', import.meta.url).pathname
  try {
    const paths = writeOutputs(outDir, {
      blogMarkdown: '# A Blog Post\n\nSome content.',
      newsletterText: 'A short blurb.',
      socialClips: ['Clip one.', 'Clip two.'],
    })
    assert.ok(existsSync(paths.blogPath))
    assert.ok(existsSync(paths.newsletterPath))
    assert.ok(existsSync(paths.clipsPath))
    assert.match(readFileSync(paths.blogPath, 'utf8'), /# A Blog Post/)
    assert.match(readFileSync(paths.newsletterPath, 'utf8'), /A short blurb\./)
    assert.match(readFileSync(paths.clipsPath, 'utf8'), /1\. Clip one\./)
    assert.match(readFileSync(paths.clipsPath, 'utf8'), /2\. Clip two\./)
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
