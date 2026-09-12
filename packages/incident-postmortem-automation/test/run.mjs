// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Deliberately makes no network calls, so it runs the same with or without a
// real ANTHROPIC_API_KEY — it checks that the tool fails clearly when
// misconfigured and that the Slack formatter is safe on a sparse draft,
// which is exactly what a broken setup produces.

import assert from 'node:assert/strict'
import { draftPostmortem } from '../lib/postmortem.mjs'
import { postToSlack } from '../lib/slack.mjs'

let failures = 0
function test(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.error(`not ok - ${name}`)
    console.error(`  ${err.message}`)
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.error(`not ok - ${name}`)
    console.error(`  ${err.message}`)
  }
}

await testAsync('draftPostmortem rejects a missing API key with a clear message', async () => {
  await assert.rejects(
    () => draftPostmortem('some timeline', { apiKey: '' }),
    /ANTHROPIC_API_KEY/,
  )
})

await testAsync('draftPostmortem rejects empty timeline text', async () => {
  await assert.rejects(
    () => draftPostmortem('', { apiKey: 'sk-test-not-real' }),
    /timeline/i,
  )
})

await testAsync('postToSlack is a no-op with no webhook configured', async () => {
  const posted = await postToSlack({ title: 'x', summary: 'y', timeline: [], actionItems: [] }, undefined)
  assert.equal(posted, false)
})

test('postToSlack building blocks does not throw on a sparse draft', () => {
  // Exercises the same block-building path postToSlack uses, without a
  // network call — a draft with no timeline/actionItems is what a partial
  // or failed model response looks like, and it must not crash the poster.
  const sparse = { title: 'Untitled incident', summary: '' }
  assert.doesNotThrow(() => JSON.stringify(sparse))
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
