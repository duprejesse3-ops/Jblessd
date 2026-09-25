// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Test suite. Run with: npm test   (or: node test/run.mjs)
//
// Uses node:test and node:assert — both built in, so the package still
// installs nothing. Every network-touching function (checkUrl,
// fetchSitemapUrls, discoverExternalLinks, sendDigestEmail, postSummary)
// takes an injectable `fetchFn`, so this suite exercises every branch —
// including timeouts, HEAD-not-supported fallback, and transport errors —
// with a fake fetch and never touches the real internet.

import assert from 'node:assert/strict'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import test from 'node:test'

import { mapWithConcurrency } from '../lib/concurrency.mjs'
import { parseSitemapXml, fetchSitemapUrls } from '../lib/sitemap.mjs'
import { classifyStatus, checkUrl } from '../lib/checker.mjs'
import { extractHrefs, classifyLinks, extractLinks } from '../lib/links.mjs'
import { discoverExternalLinks } from '../lib/crawl.mjs'
import { buildReport, buildSummaryText, buildEmailHtml } from '../lib/report.mjs'
import { loadConfig, validateConfig } from '../lib/config.mjs'
import { sendDigestEmail } from '../lib/mailer.mjs'
import { postSummary } from '../lib/slack.mjs'

// ---------------------------------------------------------------------------
// concurrency
// ---------------------------------------------------------------------------

test('mapWithConcurrency: preserves input order regardless of completion order', async () => {
  const items = [30, 10, 20, 5]
  const results = await mapWithConcurrency(items, 4, (ms) => new Promise((r) => setTimeout(() => r(ms), ms)))
  assert.deepEqual(results, [30, 10, 20, 5])
})

test('mapWithConcurrency: never runs more than `limit` workers at once', async () => {
  let active = 0
  let maxActive = 0
  const items = Array.from({ length: 12 }, (_, i) => i)
  await mapWithConcurrency(items, 3, async () => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((r) => setTimeout(r, 5))
    active -= 1
  })
  assert.ok(maxActive <= 3, `expected at most 3 concurrent workers, saw ${maxActive}`)
})

test('mapWithConcurrency: handles an empty list without starting any worker', async () => {
  let calls = 0
  const results = await mapWithConcurrency([], 5, () => {
    calls += 1
    return Promise.resolve('x')
  })
  assert.deepEqual(results, [])
  assert.equal(calls, 0)
})

// ---------------------------------------------------------------------------
// sitemap parsing
// ---------------------------------------------------------------------------

test('parseSitemapXml: reads a plain urlset', () => {
  const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`
  const { type, locs } = parseSitemapXml(xml)
  assert.equal(type, 'urlset')
  assert.deepEqual(locs, ['https://example.com/', 'https://example.com/about'])
})

test('parseSitemapXml: recognises a sitemap index', () => {
  const xml = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`
  const { type, locs } = parseSitemapXml(xml)
  assert.equal(type, 'sitemapindex')
  assert.deepEqual(locs, ['https://example.com/sitemap-1.xml', 'https://example.com/sitemap-2.xml'])
})

test('fetchSitemapUrls: returns the flat list from a plain sitemap', async () => {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    text: async () => `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`,
  })
  const urls = await fetchSitemapUrls('https://example.com/sitemap.xml', { fetchFn })
  assert.deepEqual(urls.sort(), ['https://example.com/a', 'https://example.com/b'])
})

test('fetchSitemapUrls: follows a sitemap index into its child sitemaps', async () => {
  const responses = {
    'https://example.com/sitemap.xml': `<sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap><sitemap><loc>https://example.com/s2.xml</loc></sitemap></sitemapindex>`,
    'https://example.com/s1.xml': `<urlset><url><loc>https://example.com/one</loc></url></urlset>`,
    'https://example.com/s2.xml': `<urlset><url><loc>https://example.com/two</loc></url></urlset>`,
  }
  const fetchFn = async (url) => ({ ok: true, status: 200, text: async () => responses[url] })
  const urls = await fetchSitemapUrls('https://example.com/sitemap.xml', { fetchFn })
  assert.deepEqual(urls.sort(), ['https://example.com/one', 'https://example.com/two'])
})

test('fetchSitemapUrls: throws with the failing sitemap URL in the message on a bad HTTP status', async () => {
  const fetchFn = async () => ({ ok: false, status: 404, text: async () => '' })
  await assert.rejects(
    () => fetchSitemapUrls('https://example.com/missing.xml', { fetchFn }),
    /missing\.xml.*404/s,
  )
})

test('fetchSitemapUrls: a self-referencing index does not loop forever', async () => {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    text: async () => `<sitemapindex><sitemap><loc>https://example.com/sitemap.xml</loc></sitemap></sitemapindex>`,
  })
  const urls = await fetchSitemapUrls('https://example.com/sitemap.xml', { fetchFn, maxSitemaps: 3 })
  assert.deepEqual(urls, [])
})

// ---------------------------------------------------------------------------
// status classification + checker
// ---------------------------------------------------------------------------

test('classifyStatus: buckets every status range correctly', () => {
  assert.equal(classifyStatus(200), 'ok')
  assert.equal(classifyStatus(204), 'ok')
  assert.equal(classifyStatus(301), 'redirect')
  assert.equal(classifyStatus(404), 'client_error')
  assert.equal(classifyStatus(429), 'client_error')
  assert.equal(classifyStatus(500), 'server_error')
  assert.equal(classifyStatus(503), 'server_error')
  assert.equal(classifyStatus(100), 'unknown')
})

test('checkUrl: a plain 200 to HEAD is reported as ok, method HEAD', async () => {
  const fetchFn = async (url, opts) => {
    assert.equal(opts.method, 'HEAD')
    return { ok: true, status: 200, url }
  }
  const result = await checkUrl('https://example.com/', { fetchFn })
  assert.equal(result.classification, 'ok')
  assert.equal(result.method, 'HEAD')
  assert.equal(result.status, 200)
})

test('checkUrl: a 404 is classified client_error', async () => {
  const fetchFn = async (url) => ({ ok: false, status: 404, url })
  const result = await checkUrl('https://example.com/gone', { fetchFn })
  assert.equal(result.classification, 'client_error')
  assert.equal(result.status, 404)
})

test('checkUrl: a 500 is classified server_error', async () => {
  const fetchFn = async (url) => ({ ok: false, status: 500, url })
  const result = await checkUrl('https://example.com/oops', { fetchFn })
  assert.equal(result.classification, 'server_error')
})

test('checkUrl: falls back to GET when HEAD returns 405', async () => {
  const calls = []
  const fetchFn = async (url, opts) => {
    calls.push(opts.method)
    if (opts.method === 'HEAD') return { ok: false, status: 405, url }
    return { ok: true, status: 200, url }
  }
  const result = await checkUrl('https://example.com/head-not-allowed', { fetchFn })
  assert.deepEqual(calls, ['HEAD', 'GET'])
  assert.equal(result.method, 'GET')
  assert.equal(result.classification, 'ok')
})

test('checkUrl: falls back to GET when HEAD throws a transport error', async () => {
  const calls = []
  const fetchFn = async (url, opts) => {
    calls.push(opts.method)
    if (opts.method === 'HEAD') throw new Error('socket hang up')
    return { ok: true, status: 200, url }
  }
  const result = await checkUrl('https://example.com/flaky-head', { fetchFn })
  assert.deepEqual(calls, ['HEAD', 'GET'])
  assert.equal(result.classification, 'ok')
})

test('checkUrl: reports "timeout" when both attempts time out', async () => {
  const timeoutError = new Error('The operation was aborted')
  timeoutError.name = 'TimeoutError'
  const fetchFn = async () => {
    throw timeoutError
  }
  const result = await checkUrl('https://example.com/slow', { fetchFn })
  assert.equal(result.classification, 'timeout')
  assert.equal(result.status, null)
})

test('checkUrl: reports "unreachable" for a plain connection failure', async () => {
  const fetchFn = async () => {
    throw new Error('getaddrinfo ENOTFOUND example.invalid')
  }
  const result = await checkUrl('https://example.invalid/', { fetchFn })
  assert.equal(result.classification, 'unreachable')
  assert.match(result.error, /ENOTFOUND/)
})

// ---------------------------------------------------------------------------
// link extraction
// ---------------------------------------------------------------------------

test('extractHrefs: pulls hrefs and skips fragments/mailto/tel/javascript', () => {
  const html = `
    <a href="/about">About</a>
    <a href="#top">Top</a>
    <a href="mailto:a@b.com">Email</a>
    <a href="tel:+15551234567">Call</a>
    <a href="javascript:void(0)">JS</a>
    <a href="https://partner.example.com/page">Partner</a>
  `
  assert.deepEqual(extractHrefs(html), ['/about', 'https://partner.example.com/page'])
})

test('classifyLinks: splits same-origin from other-origin, resolving relative hrefs', () => {
  const hrefs = ['/about', 'https://example.com/contact', 'https://partner.example.com/x', '/about']
  const { internal, external } = classifyLinks(hrefs, 'https://example.com/blog/post')
  assert.deepEqual(internal.sort(), ['https://example.com/about', 'https://example.com/contact'])
  assert.deepEqual(external, ['https://partner.example.com/x'])
})

test('classifyLinks: drops an unparsable or non-http href instead of throwing', () => {
  const { internal, external } = classifyLinks(['http://[bad', 'ftp://files.example.com/x'], 'https://example.com/')
  assert.deepEqual(internal, [])
  assert.deepEqual(external, [])
})

test('extractLinks: end-to-end convenience wrapper matches extractHrefs + classifyLinks', () => {
  const html = `<a href="/x">x</a><a href="https://other.example.com/y">y</a>`
  const { internal, external } = extractLinks(html, 'https://example.com/')
  assert.deepEqual(internal, ['https://example.com/x'])
  assert.deepEqual(external, ['https://other.example.com/y'])
})

// ---------------------------------------------------------------------------
// outbound-link discovery (crawl)
// ---------------------------------------------------------------------------

test('discoverExternalLinks: collects distinct external links across pages, capped at `limit`', async () => {
  const pages = {
    'https://example.com/': `<a href="https://ext-a.example.com/1">a</a><a href="https://ext-b.example.com/2">b</a>`,
    'https://example.com/about': `<a href="https://ext-b.example.com/2">dup</a><a href="https://ext-c.example.com/3">c</a>`,
  }
  const fetchFn = async (url) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    text: async () => pages[url],
  })
  const found = await discoverExternalLinks(['https://example.com/', 'https://example.com/about'], {
    fetchFn,
    limit: 2,
  })
  assert.equal(found.length, 2)
  assert.deepEqual(
    found.map((f) => f.url),
    ['https://ext-a.example.com/1', 'https://ext-b.example.com/2'],
  )
  assert.equal(found[0].foundOn, 'https://example.com/')
})

test('discoverExternalLinks: skips a page whose fetch fails and continues with the rest', async () => {
  const fetchFn = async (url) => {
    if (url === 'https://example.com/broken') throw new Error('connection reset')
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => `<a href="https://ext.example.com/only">x</a>`,
    }
  }
  const found = await discoverExternalLinks(['https://example.com/broken', 'https://example.com/ok'], {
    fetchFn,
    limit: 5,
  })
  assert.deepEqual(found, [{ url: 'https://ext.example.com/only', foundOn: 'https://example.com/ok' }])
})

test('discoverExternalLinks: a limit of 0 does no fetching at all', async () => {
  let calls = 0
  const fetchFn = async () => {
    calls += 1
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '' }
  }
  const found = await discoverExternalLinks(['https://example.com/'], { fetchFn, limit: 0 })
  assert.deepEqual(found, [])
  assert.equal(calls, 0)
})

// ---------------------------------------------------------------------------
// report building
// ---------------------------------------------------------------------------

function fakeResult(overrides) {
  return { url: 'https://example.com/x', method: 'HEAD', status: 200, classification: 'ok', finalUrl: 'https://example.com/x', error: null, foundOn: 'sitemap.xml', ...overrides }
}

test('buildReport: counts every classification and collects only the broken ones', () => {
  const checked = [
    fakeResult({ classification: 'ok', status: 200 }),
    fakeResult({ classification: 'ok', status: 200 }),
    fakeResult({ classification: 'redirect', status: 301, url: 'https://example.com/r' }),
    fakeResult({ classification: 'client_error', status: 404, url: 'https://example.com/404' }),
    fakeResult({ classification: 'server_error', status: 500, url: 'https://example.com/500' }),
    fakeResult({ classification: 'timeout', status: null, url: 'https://example.com/slow', error: 'timed out' }),
    fakeResult({ classification: 'unreachable', status: null, url: 'https://example.com/down', error: 'ENOTFOUND' }),
  ]
  const report = buildReport(checked, { siteName: 'Test Site', sitemapUrl: 'https://example.com/sitemap.xml' })

  assert.equal(report.totalChecked, 7)
  assert.equal(report.counts.ok, 2)
  assert.equal(report.counts.redirect, 1)
  assert.equal(report.counts.client_error, 1)
  assert.equal(report.counts.server_error, 1)
  assert.equal(report.counts.timeout, 1)
  assert.equal(report.counts.unreachable, 1)
  assert.equal(report.brokenCount, 4)
  assert.equal(report.siteName, 'Test Site')
})

test('buildReport: orders broken entries by severity, worst first', () => {
  const checked = [
    fakeResult({ classification: 'client_error', status: 404, url: 'https://example.com/404' }),
    fakeResult({ classification: 'server_error', status: 500, url: 'https://example.com/500' }),
    fakeResult({ classification: 'unreachable', status: null, url: 'https://example.com/down' }),
  ]
  const report = buildReport(checked)
  assert.deepEqual(
    report.broken.map((b) => b.classification),
    ['server_error', 'unreachable', 'client_error'],
  )
})

test('buildReport: an all-clear run has brokenCount 0 and an empty broken list', () => {
  const report = buildReport([fakeResult(), fakeResult({ url: 'https://example.com/y' })])
  assert.equal(report.brokenCount, 0)
  assert.deepEqual(report.broken, [])
})

test('buildSummaryText: names every broken URL and where it was found', () => {
  const report = buildReport([fakeResult({ classification: 'client_error', status: 404, url: 'https://example.com/404', foundOn: 'https://example.com/blog' })])
  const text = buildSummaryText(report)
  assert.match(text, /https:\/\/example\.com\/404/)
  assert.match(text, /HTTP 404/)
  assert.match(text, /found on https:\/\/example\.com\/blog/)
})

test('buildSummaryText: says so plainly when nothing is broken', () => {
  const report = buildReport([fakeResult()])
  assert.match(buildSummaryText(report), /Nothing broken this run/)
})

test('buildEmailHtml: renders counts and a row per broken link, escaping HTML in the URL', () => {
  const report = buildReport([
    fakeResult({ classification: 'client_error', status: 404, url: 'https://example.com/a?x=1&y=2', foundOn: 'https://example.com/' }),
  ])
  const html = buildEmailHtml(report)
  assert.match(html, /<!doctype html>/)
  assert.match(html, /a\?x=1&amp;y=2/)
  assert.doesNotMatch(html, /a\?x=1&y=2"/) // raw ampersand must not appear unescaped inside the href
})

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

test('validateConfig: fills in defaults for optional fields', () => {
  const config = validateConfig({ sitemapUrl: 'https://example.com/sitemap.xml', toEmail: 'you@example.com' })
  assert.equal(config.concurrency, 5)
  assert.equal(config.checkExternalLinks, false)
  assert.equal(config.externalLinkLimit, 20)
  assert.equal(config.requestTimeoutMs, 8000)
})

test('validateConfig: rejects a missing sitemapUrl', () => {
  assert.throws(() => validateConfig({ toEmail: 'you@example.com' }), /sitemapUrl/)
})

test('validateConfig: rejects an invalid sitemapUrl', () => {
  assert.throws(() => validateConfig({ sitemapUrl: 'not a url', toEmail: 'you@example.com' }), /valid URL/)
})

test('validateConfig: rejects an invalid toEmail', () => {
  assert.throws(
    () => validateConfig({ sitemapUrl: 'https://example.com/sitemap.xml', toEmail: 'not-an-email' }),
    /valid email/,
  )
})

test('validateConfig: rejects a non-positive concurrency', () => {
  assert.throws(
    () => validateConfig({ sitemapUrl: 'https://example.com/sitemap.xml', toEmail: 'you@example.com', concurrency: 0 }),
    /concurrency/,
  )
})

test('validateConfig: rejects a non-boolean checkExternalLinks', () => {
  assert.throws(
    () =>
      validateConfig({
        sitemapUrl: 'https://example.com/sitemap.xml',
        toEmail: 'you@example.com',
        checkExternalLinks: 'yes',
      }),
    /checkExternalLinks/,
  )
})

test('loadConfig: accepts the shipped config.example.json as-is', () => {
  const path = new URL('../config.example.json', import.meta.url).pathname
  const config = loadConfig(path)
  assert.ok(config.sitemapUrl)
  assert.ok(config.toEmail)
})

test('loadConfig: rejects a config file that is not valid JSON', () => {
  const path = new URL('./tmp-bad-json.json', import.meta.url).pathname
  writeFileSync(path, '{ not json')
  try {
    assert.throws(() => loadConfig(path), /not valid JSON/)
  } finally {
    unlinkSync(path)
  }
})

// ---------------------------------------------------------------------------
// mailer / slack (dry-run + validation only — no real network call)
// ---------------------------------------------------------------------------

test('sendDigestEmail: is a no-op (dry run) with no API key configured', async () => {
  const sent = await sendDigestEmail({ to: 'a@b.example', subject: 'x', html: '<p>x</p>' }, '')
  assert.equal(sent, false)
})

test('sendDigestEmail: rejects a missing recipient even with a key present', async () => {
  await assert.rejects(() => sendDigestEmail({ subject: 'x', html: '<p>x</p>' }, 'fake-key'), /email\.to/)
})

test('postSummary: is a no-op with no webhook URL configured', async () => {
  const report = buildReport([fakeResult()])
  const posted = await postSummary(report, undefined)
  assert.equal(posted, false)
})

// ---------------------------------------------------------------------------
// delivery payload
// ---------------------------------------------------------------------------

test('the embedded source shipped to buyers is in sync with this package', async () => {
  // netlify/lib/link-watchdog-source.mts is what a paying customer actually
  // receives. If the package changes and the embed is not regenerated, buyers
  // get an old version — so that is a test failure, not a warning.
  const { collect, renderModule } = await import('../tools/embed-source.mjs')
  const files = collect()

  const checkedInPath = new URL('../../../netlify/lib/link-watchdog-source.mts', import.meta.url)
  let checkedIn
  try {
    checkedIn = readFileSync(checkedInPath, 'utf8')
  } catch {
    assert.fail('netlify/lib/link-watchdog-source.mts is missing — run: node tools/embed-source.mjs')
  }

  if (checkedIn === renderModule(files)) return

  const stale = files.filter((file) => !checkedIn.includes(JSON.stringify(file.contents))).map((file) => file.path)

  assert.fail(
    `Embedded product source is stale${stale.length ? ` (${stale.join(', ')})` : ''}. ` +
      'Run: node packages/link-watchdog/tools/embed-source.mjs',
  )
})

test('the embedded source contains every file a buyer needs to run it', async () => {
  const { collect } = await import('../tools/embed-source.mjs')
  const paths = collect().map((f) => f.path)

  for (const required of [
    'README.md',
    'LICENSE.md',
    'package.json',
    '.env.example',
    'config.example.json',
    'lib/config.mjs',
    'lib/sitemap.mjs',
    'lib/checker.mjs',
    'lib/links.mjs',
    'lib/crawl.mjs',
    'lib/concurrency.mjs',
    'lib/report.mjs',
    'lib/mailer.mjs',
    'lib/slack.mjs',
    'bin/watchdog.mjs',
    '.github-workflow-template/link-watchdog.yml',
    'test/run.mjs',
  ]) {
    assert.ok(paths.includes(required), `delivery payload is missing ${required}`)
  }

  // The seller's build step is not part of the product.
  assert.ok(!paths.some((p) => p.startsWith('tools/')), 'tools/ should not be shipped to buyers')
})
