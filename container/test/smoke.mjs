// Smoke tests for the container runtime.
//
// These cover the seams — the places where this container reimplements
// something Netlify used to do — because those are what break silently. The
// application's own logic is not retested here; it is unchanged.
//
//   node --import ./container/hooks/register.mjs container/test/smoke.mjs

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import pg from 'pg'

import { loadNetlifyConfig, parseToml } from '../lib/config.mjs'
import { matchesPath, splat } from '../lib/match.mjs'
import { cronMatches, parseCron } from '../lib/scheduler.mjs'
import { headersFor, isDeniedPath } from '../lib/static.mjs'
import { isFormSubmission } from '../lib/forms.mjs'

const APP_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '../..'))

let passed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    return
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function equal(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, `expected ${e}, got ${a}`)
}

// --- netlify.toml is parsed, not duplicated -------------------------------

const config = loadNetlifyConfig(join(APP_ROOT, 'netlify.toml'))

equal('publish directory', config.publish, '.')
equal('functions directory', config.functionsDir, 'netlify/functions')
check('redirects found', config.redirects.length >= 4, `got ${config.redirects.length}`)
check('header rules found', config.headers.length >= 10, `got ${config.headers.length}`)
check('edge declarations found', config.edgeFunctions.length >= 3, `got ${config.edgeFunctions.length}`)

const apiRedirect = config.redirects.find((r) => r.from === '/api/*')
equal('api redirect target', apiRedirect?.to, '/.netlify/functions/:splat')
equal('api redirect status is a rewrite', apiRedirect?.status, 200)

const csp = config.edgeFunctions.find((e) => e.function === 'csp')
check('csp excludedPath parsed as a list', Array.isArray(csp?.excludedPath) && csp.excludedPath.length > 5)
check('csp excludes the API', csp?.excludedPath?.includes('/api/*'))

// Multi-line arrays and quoted '#' are the two things a naive parser gets wrong.
const tricky = parseToml(`
[build]
  publish = "."
[[headers]]
  for = "/*"
  [headers.values]
    Colour = "#ffffff"   # a comment after a quoted hash
    List = [
      "one",
      "two",
    ]
`)
equal('quoted hash survives comment stripping', tricky.headers[0].values.Colour, '#ffffff')
equal('multi-line array parsed', tricky.headers[0].values.List, ['one', 'two'])

// --- path matching --------------------------------------------------------

check('wildcard matches nested', matchesPath('/product/AI-AG-065', '/product/*'))
check('wildcard matches root catch-all', matchesPath('/anything/at/all', '/*'))
check('extension pattern matches', matchesPath('/marketing-measurement.js', '/*.js'))
check('extension pattern is anchored', !matchesPath('/script.js.map', '/*.js'))
check('exact pattern does not over-match', !matchesPath('/agentx', '/agent'))
check('list form matches any member', matchesPath('/index.html', ['/', '/index.html']))
equal('splat captures the tail', splat('/api/products', '/api/*'), 'products')
equal('splat of a nested path', splat('/api/a/b', '/api/*'), 'a/b')

// --- cron -----------------------------------------------------------------

const hourly = parseCron('0 * * * *')
check('hourly fires on the hour', cronMatches(hourly, new Date('2026-08-06T14:00:00Z')))
check('hourly does not fire mid-hour', !cronMatches(hourly, new Date('2026-08-06T14:30:00Z')))

const twiceDaily = parseCron('0 */12 * * *')
check('step fires at 00:00', cronMatches(twiceDaily, new Date('2026-08-06T00:00:00Z')))
check('step fires at 12:00', cronMatches(twiceDaily, new Date('2026-08-06T12:00:00Z')))
check('step does not fire at 13:00', !cronMatches(twiceDaily, new Date('2026-08-06T13:00:00Z')))

const daily3am = parseCron('0 3 * * *')
check('daily fires at 03:00 UTC', cronMatches(daily3am, new Date('2026-08-06T03:00:00Z')))
check('daily ignores local midnight offsets', !cronMatches(daily3am, new Date('2026-08-06T04:00:00Z')))

const weekly = parseCron('@weekly')
check('@weekly fires Sunday midnight', cronMatches(weekly, new Date('2026-08-09T00:00:00Z')))
check('@weekly skips Monday', !cronMatches(weekly, new Date('2026-08-10T00:00:00Z')))

// Every schedule the application actually declares must parse.
for (const expression of ['0 */12 * * *', '0 * * * *', '@weekly', '0 3 * * *']) {
  let ok = true
  try {
    parseCron(expression)
  } catch {
    ok = false
  }
  check(`declared schedule parses: ${expression}`, ok)
}

// --- header precedence ----------------------------------------------------

const faviconHeaders = headersFor('/favicon.ico', config.headers)
equal('declared Content-Type wins for favicon', faviconHeaders['Content-Type'], 'image/x-icon')
check('global security headers still apply', Boolean(faviconHeaders['X-Content-Type-Options']))

const adminHeaders = headersFor('/admin.html', config.headers)
equal('admin is never cached', adminHeaders['Cache-Control'], 'no-store')

// --- publish-root exposure ------------------------------------------------
//
// publish = "." means the repository root is the served directory, so the
// server's own source sits inside it. These paths must never resolve to a file.

for (const path of [
  'netlify/lib/admin-auth.mts',
  'netlify/functions/code-serve.mts',
  'netlify/edge-functions/csp.ts',
  'netlify/database/migrations/001_init.sql',
  'container/server.mjs',
  'container/.env',
  'container/.env.example',
  'packages/site-audit-agent/lib/audit.mjs',
  'node_modules/pg/package.json',
  'package.json',
  'package-lock.json',
  'netlify.toml',
  'deno.lock',
  '.env',
  '.git/config',
  '.netlify/state.json',
]) {
  check(`denied: ${path}`, isDeniedPath(path))
}

// Case folding: on macOS and Windows these open the same files as the
// lower-cased paths above, so the check cannot be case-sensitive.
check('denied case-insensitively: NETLIFY/', isDeniedPath('NETLIFY/lib/admin-auth.mts'))
check('denied case-insensitively: Container/.Env', isDeniedPath('Container/.Env'))

for (const path of [
  'index.html',
  '404.html',
  'admin.html',
  'code.html',
  'agent.html',
  'sw.js',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
  'icons/icon-192.png',
]) {
  check(`still served: ${path}`, !isDeniedPath(path))
}

check('the published dotfile is still served', !isDeniedPath('.well-known/assetlinks.json'))
check('an empty path is not denied', !isDeniedPath(''))
// Segment match, not substring: a page whose name merely contains a denied word
// is an ordinary page.
check('denial matches whole segments only', !isDeniedPath('netlify-guide.md'))

// --- form detection -------------------------------------------------------

const post = (type) =>
  isFormSubmission({ method: 'POST' }, type)
check('urlencoded POST is a form', post('application/x-www-form-urlencoded'))
check('multipart POST is a form', post('multipart/form-data; boundary=x'))
check('JSON POST is not a form', !post('application/json'))
check('GET is never a form', !isFormSubmission({ method: 'GET' }, 'application/x-www-form-urlencoded'))

// --- database adapter: tagged template becomes bind parameters ------------

const captured = []
const realQuery = pg.Pool.prototype.query
pg.Pool.prototype.query = async function stub(text, values) {
  captured.push({ text, values })
  return { rows: [{ ok: true }] }
}
process.env.DATABASE_URL ||= 'postgres://user:pw@localhost:5432/db'

try {
  const { getDatabase } = await import('../adapters/netlify-database.mjs')
  const db = getDatabase()

  const sku = 'AI-AG-065'
  const limit = 5
  const rows = await db.sql`SELECT * FROM products WHERE sku = ${sku} LIMIT ${limit}`

  equal('rows are returned directly, as Netlify does', rows, [{ ok: true }])
  equal(
    'values become positional parameters',
    captured[0].text.replace(/\s+/g, ' ').trim(),
    'SELECT * FROM products WHERE sku = $1 LIMIT $2',
  )
  equal('values are bound, never interpolated', captured[0].values, [sku, limit])
  check('no value text leaks into the SQL', !captured[0].text.includes(sku))

  // A value that would be catastrophic if concatenated.
  captured.length = 0
  const hostile = "'; DROP TABLE products; --"
  await db.sql`SELECT ${hostile}`
  check('injection attempt stays a parameter', !captured[0].text.includes('DROP TABLE'))
  equal('injection attempt is passed as data', captured[0].values, [hostile])
} finally {
  pg.Pool.prototype.query = realQuery
}

// --- blobs adapter --------------------------------------------------------

const blobDir = join('/tmp', `container-smoke-${process.pid}`)
process.env.BLOBS_DIR = blobDir

try {
  const { getStore } = await import('../adapters/netlify-blobs.mjs')

  const rateLimits = getStore('rate-limits')
  equal('missing key is null, not undefined', await rateLimits.get('absent', { type: 'json' }), null)

  await rateLimits.setJSON('1.2.3.4', { count: 3 })
  equal('json round-trip', await rateLimits.get('1.2.3.4', { type: 'json' }), { count: 3 })

  const dedup = getStore({ name: 'dedup', consistency: 'strong' })
  await dedup.set('cs_test', 'sent')
  equal('text round-trip', await dedup.get('cs_test', { type: 'text' }), 'sent')
  equal('stores are isolated from each other', await rateLimits.get('cs_test', { type: 'text' }), null)

  await dedup.delete('cs_test')
  equal('delete removes the key', await dedup.get('cs_test', { type: 'text' }), null)

  // Keys come from client IPs and Stripe session ids, so they are untrusted.
  await dedup.set('../../../etc/passwd', 'contained')
  equal('traversal key is contained', await dedup.get('../../../etc/passwd', { type: 'text' }), 'contained')
  const { existsSync } = await import('node:fs')
  check('nothing was written outside the blob root', !existsSync('/tmp/etc/passwd'))
} finally {
  await rm(blobDir, { recursive: true, force: true })
}

// --- report ---------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`)
for (const failure of failures) console.error(`  FAIL  ${failure}`)
process.exit(failures.length ? 1 : 0)
