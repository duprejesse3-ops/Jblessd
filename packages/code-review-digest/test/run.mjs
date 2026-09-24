// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { draftDigest } from '../lib/digest.mjs'
import { postToSlack } from '../lib/slack.mjs'
import { listOpenPRs } from '../lib/github.mjs'

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

await test('draftDigest rejects a missing API key', async () => {
  await assert.rejects(() => draftDigest([{ number: 1, title: 'x' }], { apiKey: '' }), /ANTHROPIC_API_KEY/)
})

await test('draftDigest returns a clean empty digest with no PRs, no API call needed', async () => {
  const digest = await draftDigest([], { apiKey: 'sk-test-not-real' })
  assert.equal(digest.headline, 'No open pull requests.')
  assert.deepEqual(digest.needsAttention, [])
})

await test('postToSlack is a no-op with no webhook configured', async () => {
  const posted = await postToSlack({ headline: 'x' }, undefined)
  assert.equal(posted, false)
})

await test('listOpenPRs rejects when GITHUB_REPOSITORY is not set', async () => {
  const saved = process.env.GITHUB_REPOSITORY
  delete process.env.GITHUB_REPOSITORY
  try {
    await assert.rejects(() => listOpenPRs(), /GITHUB_REPOSITORY/)
  } finally {
    if (saved) process.env.GITHUB_REPOSITORY = saved
  }
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
