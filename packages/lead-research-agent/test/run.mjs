// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { parseCsv, toCsv } from '../lib/csv.mjs'
import { stripHtml, extractTitle } from '../lib/site-fetch.mjs'
import { buildEnrichmentPrompt, parseEnrichmentResponse } from '../lib/enrichment.mjs'
import { loadCache, saveCache, hasCached, recordCache } from '../lib/cache.mjs'
import { unlinkSync } from 'node:fs'

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

// ---- csv --------------------------------------------------------------------

await test('parseCsv: parses a simple header + rows', () => {
  const rows = parseCsv('domain,company\nacme.com,Acme Inc\nexample.com,Example LLC\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].domain, 'acme.com')
  assert.equal(rows[1].company, 'Example LLC')
})

await test('parseCsv: handles quoted fields containing commas', () => {
  const rows = parseCsv('domain,company\nacme.com,"Acme, Inc"\n')
  assert.equal(rows[0].company, 'Acme, Inc')
})

await test('parseCsv: returns [] for empty input', () => {
  assert.deepEqual(parseCsv(''), [])
})

await test('toCsv/parseCsv: round-trips through both', () => {
  const rows = [{ domain: 'acme.com', industry: 'B2B SaaS, analytics' }]
  const csv = toCsv(rows)
  const reparsed = parseCsv(csv)
  assert.deepEqual(reparsed, rows)
})

// ---- site-fetch (pure text-processing parts only, no live fetch) -----------

await test('stripHtml: removes tags, scripts, and styles', () => {
  const html = '<html><head><style>.x{color:red}</style></head><body><script>evil()</script><p>Hello <b>World</b></p></body></html>'
  assert.equal(stripHtml(html), 'Hello World')
})

await test('stripHtml: decodes common entities', () => {
  assert.equal(stripHtml('<p>Tom &amp; Jerry &quot;fun&quot;</p>'), 'Tom & Jerry "fun"')
})

await test('extractTitle: pulls the <title> text', () => {
  assert.equal(extractTitle('<html><head><title>Acme &amp; Co</title></head></html>'), 'Acme & Co')
})

await test('extractTitle: null when there is no title tag', () => {
  assert.equal(extractTitle('<html><body>hi</body></html>'), null)
})

// ---- enrichment ---------------------------------------------------------------

await test('buildEnrichmentPrompt: includes the site url and extracted text', () => {
  const prompt = buildEnrichmentPrompt({ url: 'https://acme.com', title: 'Acme', text: 'We sell widgets.' })
  assert.match(prompt, /https:\/\/acme\.com/)
  assert.match(prompt, /We sell widgets\./)
})

await test('parseEnrichmentResponse: extracts all four labeled fields', () => {
  const reply = [
    'Industry: B2B SaaS - analytics',
    'Size signal: mentions 50-person team',
    'Value prop: Helps teams track marketing spend.',
    'Contact page: https://acme.com/contact',
  ].join('\n')
  const fields = parseEnrichmentResponse(reply)
  assert.equal(fields.industry, 'B2B SaaS - analytics')
  assert.equal(fields.sizeSignal, 'mentions 50-person team')
  assert.equal(fields.valueProp, 'Helps teams track marketing spend.')
  assert.equal(fields.contactPageGuess, 'https://acme.com/contact')
})

await test('parseEnrichmentResponse: "unknown" becomes null, not the literal string', () => {
  const reply = 'Industry: unknown\nSize signal: unknown\nValue prop: unknown\nContact page: unknown'
  const fields = parseEnrichmentResponse(reply)
  assert.equal(fields.industry, null)
  assert.equal(fields.contactPageGuess, null)
})

await test('parseEnrichmentResponse: a missing label parses to null instead of throwing', () => {
  const fields = parseEnrichmentResponse('Industry: B2B SaaS')
  assert.equal(fields.industry, 'B2B SaaS')
  assert.equal(fields.sizeSignal, null)
})

// ---- cache ----------------------------------------------------------------------

await test('cache: hasCached/recordCache round-trip', () => {
  let cache = {}
  assert.equal(hasCached(cache, 'acme.com'), false)
  cache = recordCache(cache, 'acme.com', { industry: 'SaaS' })
  assert.equal(hasCached(cache, 'acme.com'), true)
  assert.equal(cache['acme.com'].industry, 'SaaS')
  assert.ok(cache['acme.com'].cachedAt)
})

await test('cache: loadCache returns {} for a missing file', () => {
  const path = new URL('./tmp-missing-cache.json', import.meta.url).pathname
  assert.deepEqual(loadCache(path), {})
})

await test('cache: saveCache/loadCache round-trip through disk', () => {
  const path = new URL('./tmp-cache.json', import.meta.url).pathname
  const cache = recordCache({}, 'acme.com', { industry: 'SaaS' })
  saveCache(path, cache)
  try {
    const reloaded = loadCache(path)
    assert.equal(reloaded['acme.com'].industry, 'SaaS')
  } finally {
    unlinkSync(path)
  }
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
