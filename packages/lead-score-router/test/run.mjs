// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync } from 'node:fs'
import { loadConfig, tierForScore } from '../lib/config.mjs'
import { buildScoringPrompt, parseScoreResponse } from '../lib/scorer.mjs'
import { buildRoutingMessage, postToSlack } from '../lib/router.mjs'
import { loadState, saveState, hasBeenRouted, recordRouted } from '../lib/state.mjs'

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

const TIERS = [
  { name: 'Hot', minScore: 80, webhookUrl: 'https://hooks.slack.com/hot' },
  { name: 'Warm', minScore: 50, webhookUrl: 'https://hooks.slack.com/warm' },
  { name: 'Nurture', minScore: 0, webhookUrl: null },
]

// ---- config -----------------------------------------------------------------

await test('loadConfig: rejects a missing icpDescription', () => {
  const path = new URL('./tmp-no-icp.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify({ tiers: [{ name: 'Hot', minScore: 80 }] }))
  try {
    assert.throws(() => loadConfig(path), /icpDescription/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: rejects an empty tiers array', () => {
  const path = new URL('./tmp-no-tiers.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify({ icpDescription: 'x', tiers: [] }))
  try {
    assert.throws(() => loadConfig(path), /at least one entry/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: rejects a tier with an out-of-range minScore', () => {
  const path = new URL('./tmp-bad-score.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify({ icpDescription: 'x', tiers: [{ name: 'Hot', minScore: 150 }] }))
  try {
    assert.throws(() => loadConfig(path), /between 0 and 100/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: sorts tiers descending by minScore regardless of input order', () => {
  const path = new URL('./tmp-unsorted-tiers.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify({
    icpDescription: 'x',
    tiers: [{ name: 'Warm', minScore: 50 }, { name: 'Hot', minScore: 80 }, { name: 'Nurture', minScore: 0 }],
  }))
  try {
    const config = loadConfig(path)
    assert.deepEqual(config.tiers.map((t) => t.name), ['Hot', 'Warm', 'Nurture'])
  } finally {
    unlinkSync(path)
  }
})

// ---- tierForScore -------------------------------------------------------------

await test('tierForScore: picks the highest tier the score qualifies for', () => {
  assert.equal(tierForScore(95, TIERS).name, 'Hot')
  assert.equal(tierForScore(80, TIERS).name, 'Hot')
  assert.equal(tierForScore(60, TIERS).name, 'Warm')
  assert.equal(tierForScore(10, TIERS).name, 'Nurture')
})

await test('tierForScore: null when no tier matches (e.g. tiers list has a floor above 0)', () => {
  const floored = [{ name: 'Hot', minScore: 80 }]
  assert.equal(tierForScore(50, floored), null)
})

// ---- scorer ---------------------------------------------------------------------

await test('buildScoringPrompt: includes the ICP and the lead fields', () => {
  const prompt = buildScoringPrompt({ name: 'Dana', company: 'Acme' }, 'Series A B2B SaaS founders')
  assert.match(prompt, /Series A B2B SaaS founders/)
  assert.match(prompt, /name: Dana/)
  assert.match(prompt, /company: Acme/)
})

await test('buildScoringPrompt: omits blank/undefined fields', () => {
  const prompt = buildScoringPrompt({ name: 'Dana', notes: '' }, 'x')
  assert.ok(!prompt.includes('notes:'))
})

await test('parseScoreResponse: extracts score and reason', () => {
  const { score, reason } = parseScoreResponse('Score: 87\nReason: Strong match on company size and industry.')
  assert.equal(score, 87)
  assert.equal(reason, 'Strong match on company size and industry.')
})

await test('parseScoreResponse: clamps an out-of-range score into 0-100', () => {
  assert.equal(parseScoreResponse('Score: 140\nReason: x').score, 100)
})

await test('parseScoreResponse: throws when there is no Score line', () => {
  assert.throws(() => parseScoreResponse('Reason: no score given'), /Score/)
})

// ---- router ----------------------------------------------------------------------

await test('buildRoutingMessage: names the tier, score, and lead identity', () => {
  const message = buildRoutingMessage({
    lead: { name: 'Dana Ortiz', email: 'dana@example.com', company: 'Acme' },
    scoreResult: { score: 91, reason: 'Great fit' },
    tier: { name: 'Hot', minScore: 80 },
  })
  assert.match(message, /Hot/)
  assert.match(message, /91/)
  assert.match(message, /Dana Ortiz/)
  assert.match(message, /Great fit/)
})

await test('postToSlack: no-op (false) with no webhook URL', async () => {
  assert.equal(await postToSlack(null, 'hi'), false)
  assert.equal(await postToSlack(undefined, 'hi'), false)
})

// ---- state (dedupe tracking) -----------------------------------------------------

await test('state: hasBeenRouted/recordRouted round-trip', () => {
  let state = {}
  assert.equal(hasBeenRouted(state, 'dana@example.com'), false)
  state = recordRouted(state, 'dana@example.com', { score: 90, tier: 'Hot' })
  assert.equal(hasBeenRouted(state, 'dana@example.com'), true)
  assert.equal(state['dana@example.com'].tier, 'Hot')
})

await test('state: loadState returns {} for a missing file', () => {
  const path = new URL('./tmp-missing-state.json', import.meta.url).pathname
  assert.deepEqual(loadState(path), {})
})

await test('state: saveState/loadState round-trip through disk', () => {
  const path = new URL('./tmp-state.json', import.meta.url).pathname
  const state = recordRouted({}, 'dana@example.com', { score: 90, tier: 'Hot' })
  saveState(path, state)
  try {
    const reloaded = loadState(path)
    assert.equal(hasBeenRouted(reloaded, 'dana@example.com'), true)
  } finally {
    unlinkSync(path)
  }
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
