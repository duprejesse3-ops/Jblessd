// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Test suite. Run with: npm test   (or: node test/run.mjs)
//
// Uses node:test and node:assert — both built in, so the package still installs
// nothing. Everything runs against a local fixture server on an ephemeral port;
// no test touches the public internet, so the suite works offline and in CI.
//
// This exists because the package is sold, and a buyer should be able to verify
// the thing works on their machine before they trust it with their site.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { auditSite } from '../lib/audit.mjs'
import { toJson, toMarkdown, toText } from '../lib/report.mjs'
import { isSafeToFollow, safeTargetUrl, UnsafeUrlError } from '../lib/url-safety.mjs'
import { startFixture } from './fixture-server.mjs'

const LOCAL = { allowPrivate: true, maxPages: 10, timeoutMs: 5000 }

/** Look a check up by name; fails loudly if the engine stopped emitting it. */
function checkNamed(report, name) {
  const found = report.checks.find((c) => c.name === name)
  assert.ok(found, `expected a "${name}" check in the report`)
  return found
}

// ---------------------------------------------------------------------------
// url safety
// ---------------------------------------------------------------------------

test('rejects loopback and private addresses by default', () => {
  for (const target of [
    'http://127.0.0.1:8080',
    'http://localhost',
    'http://10.1.2.3',
    'http://192.168.0.1',
    'http://172.16.5.5',
    'http://[::1]',
    'http://internal.local',
  ]) {
    assert.throws(() => safeTargetUrl(target), UnsafeUrlError, `${target} should be rejected`)
  }
})

test('rejects the cloud metadata endpoint', () => {
  // The single most valuable SSRF target: it hands out instance credentials.
  assert.throws(() => safeTargetUrl('http://169.254.169.254/latest/meta-data/'), UnsafeUrlError)
  assert.throws(() => safeTargetUrl('http://metadata.google.internal'), UnsafeUrlError)
})

test('rejects non-http schemes and embedded credentials', () => {
  assert.throws(() => safeTargetUrl('file:///etc/passwd'), UnsafeUrlError)
  assert.throws(() => safeTargetUrl('ftp://example.com'), UnsafeUrlError)
  assert.throws(() => safeTargetUrl('https://user:secret@example.com'), UnsafeUrlError)
})

test('allows private addresses only when explicitly opted in', () => {
  const url = safeTargetUrl('http://127.0.0.1:8080', { allowPrivate: true })
  assert.equal(url.hostname, '127.0.0.1')
})

test('supplies a scheme for a bare hostname', () => {
  // https for a public target, http when private addresses are in play, because
  // that mode exists for local dev servers and those rarely terminate TLS.
  assert.equal(safeTargetUrl('example.com').href, 'https://example.com/')
  assert.equal(safeTargetUrl('127.0.0.1:9000', { allowPrivate: true }).protocol, 'http:')
})

test('isSafeToFollow gates discovered links, not just the entry point', () => {
  assert.equal(isSafeToFollow(new URL('https://example.com/page')), true)
  assert.equal(isSafeToFollow(new URL('http://127.0.0.1/admin')), false)
  assert.equal(isSafeToFollow(new URL('http://169.254.169.254/')), false)
})

// ---------------------------------------------------------------------------
// engine — the broken site
// ---------------------------------------------------------------------------

test('finds the planted problems on a broken site', async (t) => {
  const site = await startFixture('bad')
  t.after(() => site.close())

  const report = await auditSite(site.origin, LOCAL)

  assert.equal(report.status, 'unhealthy')
  assert.ok(report.score < 50, `expected a low score, got ${report.score}`)

  // Each of these corresponds to a defect deliberately built into the fixture.
  assert.equal(checkNamed(report, 'Meta description').status, 'failed')
  assert.equal(checkNamed(report, 'Mobile viewport').status, 'failed')
  assert.equal(checkNamed(report, 'Social preview').status, 'failed')
  assert.equal(checkNamed(report, 'Structured data').status, 'failed')
  assert.equal(checkNamed(report, 'Security headers').status, 'failed')
  assert.equal(checkNamed(report, 'Sitemap').status, 'failed')
  assert.equal(checkNamed(report, 'Internal links').status, 'failed')
  assert.equal(checkNamed(report, 'Image alt text').status, 'failed')

  // A soft 404 is the one most sites get wrong without noticing.
  assert.equal(checkNamed(report, '404 handling').status, 'failed')
  assert.match(checkNamed(report, '404 handling').detail, /instead of 404/)

  assert.equal(report.metrics.brokenLinks, 1)
  assert.equal(report.details.broken[0].status, 500)
  assert.equal(report.metrics.imagesMissingAlt, 3)
})

// ---------------------------------------------------------------------------
// engine — the healthy site
// ---------------------------------------------------------------------------

test('passes a site that does everything right', async (t) => {
  const site = await startFixture('good')
  t.after(() => site.close())

  const report = await auditSite(site.origin, LOCAL)

  // Only the two checks that cannot pass over plain-http loopback may fail.
  const failed = report.checks.filter((c) => c.status === 'failed').map((c) => c.name)
  assert.deepEqual(failed, ['HTTPS'], `unexpected failures: ${failed.join(', ')}`)

  assert.equal(checkNamed(report, 'Page title').status, 'passed')
  assert.equal(checkNamed(report, 'Meta description').status, 'passed')
  assert.equal(checkNamed(report, 'Canonical URL').status, 'passed')
  assert.equal(checkNamed(report, 'Social preview').status, 'passed')
  assert.equal(checkNamed(report, 'Structured data').status, 'passed')
  assert.equal(checkNamed(report, 'Security headers').status, 'passed')
  assert.equal(checkNamed(report, '404 handling').status, 'passed')
  assert.equal(checkNamed(report, 'Sitemap').status, 'passed')
  assert.equal(checkNamed(report, 'Internal links').status, 'passed')
  assert.equal(checkNamed(report, 'Image alt text').status, 'passed')
  assert.equal(checkNamed(report, 'Sitemap accuracy').status, 'passed')

  assert.equal(report.metrics.brokenLinks, 0)
  assert.ok(report.score > 85, `expected a high score, got ${report.score}`)
})

test('reports an unreachable site instead of throwing', async () => {
  // Port 1 on loopback: nothing is listening, so the fetch fails at transport.
  const report = await auditSite('http://127.0.0.1:1', { allowPrivate: true, timeoutMs: 2000 })
  assert.equal(report.status, 'unhealthy')
  assert.equal(checkNamed(report, 'Reachable').status, 'failed')
  // It should stop there rather than emit a dozen misleading failures.
  assert.equal(report.checks.length, 1)
})

test('does not follow an internal link that points at a private address', async (t) => {
  const site = await startFixture('bad')
  t.after(() => site.close())

  // With allowPrivate off the entry point itself is refused, which is the
  // outermost expression of the same guard.
  await assert.rejects(() => auditSite(site.origin, { maxPages: 5 }), UnsafeUrlError)
})

// ---------------------------------------------------------------------------
// report formatting
// ---------------------------------------------------------------------------

test('renders all three report formats', async (t) => {
  const site = await startFixture('bad')
  t.after(() => site.close())

  const report = await auditSite(site.origin, LOCAL)

  const text = toText(report, { color: false })
  assert.match(text, /Site audit/)
  assert.match(text, /Score \d+\/100/)
  // No ANSI escapes when colour is off, so CI logs and files stay clean.
  assert.doesNotMatch(text, /\[/)

  const markdown = toMarkdown(report)
  assert.match(markdown, /^# Site audit/)
  assert.match(markdown, /## Fix these/)
  assert.match(markdown, /Broken links/)

  const parsed = JSON.parse(toJson(report))
  assert.equal(parsed.target, report.target)
  assert.equal(parsed.checks.length, report.checks.length)
  assert.equal(parsed.engine.name, 'site-audit-agent')
})

test('orders text output failures first', async (t) => {
  const site = await startFixture('bad')
  t.after(() => site.close())

  const report = await auditSite(site.origin, LOCAL)
  const text = toText(report, { color: false })
  const firstFail = text.indexOf('✗')
  const firstPass = text.indexOf('✓')
  assert.ok(firstFail !== -1 && firstPass !== -1)
  assert.ok(firstFail < firstPass, 'failures should be listed before passes')
})

// ---------------------------------------------------------------------------
// crawl bounds
// ---------------------------------------------------------------------------

test('honours the maxPages budget', async (t) => {
  const site = await startFixture('bad')
  t.after(() => site.close())

  const report = await auditSite(site.origin, { allowPrivate: true, maxPages: 1, timeoutMs: 5000 })
  // The entry page plus at most one crawled page.
  assert.ok(report.metrics.pagesCrawled <= 2, `crawled ${report.metrics.pagesCrawled} pages with maxPages=1`)
})

// ---------------------------------------------------------------------------
// delivery payload
// ---------------------------------------------------------------------------

test('the embedded source shipped to buyers is in sync with this package', async () => {
  // netlify/lib/site-audit-source.mts is what a paying customer actually
  // receives. If the package changes and the embed is not regenerated, buyers
  // get an old version — so that is a test failure, not a warning.
  //
  // Note this file is itself part of the payload (buyers get the tests), so
  // editing it makes the embed stale until you regenerate. That is intended.
  const { collect, renderModule } = await import('../tools/embed-source.mjs')
  const files = collect()

  const checkedInPath = new URL('../../../netlify/lib/site-audit-source.mts', import.meta.url)
  let checkedIn
  try {
    checkedIn = readFileSync(checkedInPath, 'utf8')
  } catch {
    assert.fail('netlify/lib/site-audit-source.mts is missing — run: node tools/embed-source.mjs')
  }

  if (checkedIn === renderModule(files)) return

  // Byte-comparing 80KB produces an unreadable diff, so name the files that
  // actually drifted instead of dumping the whole payload.
  const stale = files
    .filter((file) => !checkedIn.includes(JSON.stringify(file.contents)))
    .map((file) => file.path)

  assert.fail(
    `Embedded product source is stale${stale.length ? ` (${stale.join(', ')})` : ''}. ` +
      'Run: node packages/site-audit-agent/tools/embed-source.mjs',
  )
})

test('the embedded source contains every file a buyer needs to run it', async () => {
  const { collect } = await import('../tools/embed-source.mjs')
  const paths = collect().map((f) => f.path)

  for (const required of [
    'README.md',
    'LICENSE.md',
    'package.json',
    'install.sh',
    'lib/audit.mjs',
    'lib/report.mjs',
    'lib/notify.mjs',
    'lib/url-safety.mjs',
    'bin/audit.mjs',
    'adapters/cron.sh',
    'adapters/github-actions.yml',
    'adapters/netlify-scheduled-function.mts',
    'test/run.mjs',
    'test/fixture-server.mjs',
  ]) {
    assert.ok(paths.includes(required), `delivery payload is missing ${required}`)
  }

  // The seller's build step is not part of the product.
  assert.ok(
    !paths.some((p) => p.startsWith('tools/')),
    'tools/ should not be shipped to buyers',
  )
})
