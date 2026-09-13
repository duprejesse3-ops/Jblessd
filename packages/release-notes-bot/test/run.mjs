// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { draftReleaseNotes } from '../lib/release-notes.mjs'
import { postToSlack } from '../lib/slack.mjs'
import { prependChangelog } from '../lib/changelog.mjs'
import { mergedSince } from '../lib/github.mjs'

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

await test('draftReleaseNotes rejects a missing API key', async () => {
  await assert.rejects(() => draftReleaseNotes('v1.0.0', [{ number: 1, title: 'x' }], { apiKey: '' }), /ANTHROPIC_API_KEY/)
})

await test('draftReleaseNotes handles an empty PR list without an API call', async () => {
  const notes = await draftReleaseNotes('v1.0.0', [], { apiKey: 'sk-test-not-real' })
  assert.match(notes.customerChangelog, /No user-facing changes/)
})

await test('postToSlack is a no-op with no webhook configured', async () => {
  const posted = await postToSlack({ version: 'v1.0.0' }, undefined)
  assert.equal(posted, false)
})

await test('mergedSince returns empty for a first release (no previous tag)', async () => {
  const original = process.env.GITHUB_REPOSITORY
  process.env.GITHUB_REPOSITORY = 'example/example'
  try {
    const prs = await mergedSince('', 'v1.0.0')
    assert.deepEqual(prs, [])
  } finally {
    if (original) process.env.GITHUB_REPOSITORY = original
    else delete process.env.GITHUB_REPOSITORY
  }
})

await test('prependChangelog creates a well-formed file from scratch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-test-'))
  const path = join(dir, 'CHANGELOG.md')
  prependChangelog(path, '## v1.0.0\n\n- First release.')
  const content = readFileSync(path, 'utf8')
  assert.match(content, /^# Changelog/)
  assert.match(content, /## v1.0.0/)
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
