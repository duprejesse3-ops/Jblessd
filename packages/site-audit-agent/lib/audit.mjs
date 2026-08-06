// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The audit engine: fetch a website, report what is wrong with it.
//
// Everything here is deliberately generic. The storefront's own in-house agents
// (netlify/functions/site-maintenance-agent, netlify/functions/discovery-crawler)
// check things only that store has — its /api/products endpoint, its own brand
// string in the HTML, its /product/:sku routes. Those checks are worthless to
// anybody else, which is precisely why they could not be sold as they were.
//
// This engine checks what is true of *every* commercial website: it resolves, it
// is served over TLS, it says what it is to a search engine, it declares
// structured data, its sitemap and robots.txt agree with reality, its internal
// links go somewhere, its images have alt text, and a missing page returns 404
// instead of 200. That is the difference between an internal script and a
// product.
//
// Constraints that make it portable, and that are worth keeping:
//   - Zero dependencies. Global fetch and URL only; nothing to npm install.
//   - Plain .mjs. No build step, no TypeScript toolchain, no bundler.
//   - No platform APIs. No Netlify, no database, no AI provider, no filesystem
//     writes. It takes a URL and returns a plain object.
// A buyer drops this folder into any Node 18+ project, on any host, and it runs.

import { isSafeToFollow, safeTargetUrl } from './url-safety.mjs'

const DEFAULTS = {
  timeoutMs: 8000,
  slowMs: 2500,
  maxPages: 25,
  concurrency: 5,
  userAgent: 'site-audit-agent/1.0 (+https://github.com/)',
  allowPrivate: false,
}

// ---------------------------------------------------------------------------
// check helpers
// ---------------------------------------------------------------------------

function check(name, status, detail, extra = {}) {
  return { name, status, detail, ...extra }
}

const pass = (name, detail, extra) => check(name, 'passed', detail, extra)
const warn = (name, detail, extra) => check(name, 'warning', detail, extra)
const fail = (name, detail, extra) => check(name, 'failed', detail, extra)

/**
 * fetch with a timeout that also reports how long the request took.
 * Never throws for HTTP status — only for transport failures.
 */
async function timedFetch(url, { timeoutMs, userAgent, accept = '*/*', method = 'GET' }) {
  const startedAt = Date.now()
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    headers: { accept, 'user-agent': userAgent },
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { response, latencyMs: Date.now() - startedAt }
}

function errorMessage(error) {
  if (error instanceof Error) {
    // AbortSignal.timeout produces a TimeoutError; say so in plain language.
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'Request timed out'
    return error.message
  }
  return 'Request failed'
}

// ---------------------------------------------------------------------------
// tiny HTML helpers — regex, not a parser
// ---------------------------------------------------------------------------
//
// A real DOM parser would be a dependency, and these checks only need presence
// and content of a handful of head elements. The regexes are deliberately
// permissive about attribute order and quoting.

function metaContent(html, nameOrProperty) {
  const attr = nameOrProperty.startsWith('og:') || nameOrProperty.startsWith('twitter:') ? 'property' : 'name'
  const pattern = new RegExp(
    `<meta[^>]*(?:${attr}|name|property)\\s*=\\s*["']${nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i',
  )
  const tag = pattern.exec(html)?.[0]
  if (!tag) return null
  return /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim() ?? null
}

function titleText(html) {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
}

function linkHref(html, rel) {
  const pattern = new RegExp(`<link[^>]*rel\\s*=\\s*["']${rel}["'][^>]*>`, 'i')
  const tag = pattern.exec(html)?.[0]
  if (!tag) return null
  return /href\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim() ?? null
}

function jsonLdBlocks(html) {
  const blocks = []
  const pattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = pattern.exec(html)) !== null) blocks.push(match[1])
  return blocks
}

/** Internal links on a page, resolved to absolute URLs on the same origin. */
function internalLinks(html, pageUrl) {
  const found = new Set()
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1].trim()
    if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue
    try {
      const resolved = new URL(href, pageUrl)
      resolved.hash = ''
      if (resolved.origin === new URL(pageUrl).origin) found.add(resolved.href)
    } catch {
      // An unparseable href is a content problem, not a crawl target.
    }
  }
  return [...found]
}

function imagesMissingAlt(html) {
  let total = 0
  let missing = 0
  const pattern = /<img\b[^>]*>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    total += 1
    const tag = match[0]
    const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(tag)
    // A decorative image may legitimately use alt="", so only a *missing*
    // attribute counts against the page.
    if (!alt) missing += 1
  }
  return { total, missing }
}

// ---------------------------------------------------------------------------
// individual checks
// ---------------------------------------------------------------------------

async function checkReachable(url, opts) {
  const name = 'Reachable'
  try {
    const { response, latencyMs } = await timedFetch(url, { ...opts, accept: 'text/html' })
    if (!response.ok) {
      return { check: fail(name, `Homepage returned HTTP ${response.status}`, { latencyMs }), html: null, response }
    }
    const html = await response.text()
    const detail = `Homepage responded in ${latencyMs}ms`
    return {
      check:
        latencyMs > opts.slowMs
          ? warn(name, `${detail} — slower than the ${opts.slowMs}ms target`, { latencyMs })
          : pass(name, detail, { latencyMs }),
      html,
      response,
    }
  } catch (error) {
    return { check: fail(name, errorMessage(error)), html: null, response: null }
  }
}

function checkTls(url, response) {
  const name = 'HTTPS'
  if (url.protocol === 'https:') {
    // response.url reflects the final URL after redirects.
    const landed = response?.url ? new URL(response.url) : url
    if (landed.protocol !== 'https:') return fail(name, 'An https request was redirected down to http')
    return pass(name, 'Served over HTTPS')
  }
  return fail(name, 'Site is served over plain http — search engines and browsers both penalise this')
}

async function checkHttpRedirect(url, opts) {
  const name = 'HTTP redirect'
  if (url.protocol !== 'https:') return warn(name, 'Skipped because the target is not https')
  const httpUrl = new URL(url.href)
  httpUrl.protocol = 'http:'
  try {
    const { response } = await timedFetch(httpUrl, { ...opts, accept: 'text/html' })
    const landed = response.url ? new URL(response.url) : httpUrl
    if (landed.protocol === 'https:') return pass(name, 'Plain http traffic is redirected to https')
    return fail(name, 'http:// is served directly instead of redirecting to https')
  } catch (error) {
    // Refusing http connections outright is a valid, secure configuration.
    return pass(name, `http:// does not respond (${errorMessage(error)}) — acceptable`)
  }
}

function checkTitle(html) {
  const name = 'Page title'
  const title = titleText(html)
  if (!title) return fail(name, '<title> is missing — this is the headline in every search result')
  if (title.length < 15) return warn(name, `Title is only ${title.length} characters: "${title}"`)
  if (title.length > 65) return warn(name, `Title is ${title.length} characters and will be truncated in search results`)
  return pass(name, `"${title}"`)
}

function checkMetaDescription(html) {
  const name = 'Meta description'
  const description = metaContent(html, 'description')
  if (!description) return fail(name, 'No meta description — search engines will invent one from page text')
  if (description.length < 50) return warn(name, `Description is only ${description.length} characters`)
  if (description.length > 160) return warn(name, `Description is ${description.length} characters and will be cut off`)
  return pass(name, `${description.length} characters`)
}

function checkCanonical(html, url) {
  const name = 'Canonical URL'
  const canonical = linkHref(html, 'canonical')
  if (!canonical) return warn(name, 'No canonical link — duplicate URLs may compete with each other')
  try {
    const resolved = new URL(canonical, url)
    if (resolved.origin !== url.origin) {
      return fail(name, `Canonical points at a different origin: ${resolved.origin}`)
    }
    return pass(name, resolved.href)
  } catch {
    return fail(name, `Canonical is not a valid URL: "${canonical}"`)
  }
}

function checkViewport(html) {
  const name = 'Mobile viewport'
  const viewport = metaContent(html, 'viewport')
  if (!viewport) return fail(name, 'No viewport meta tag — the site will render zoomed-out on phones')
  if (!/width\s*=\s*device-width/i.test(viewport)) {
    return warn(name, `Viewport does not use width=device-width: "${viewport}"`)
  }
  return pass(name, 'Configured for mobile')
}

function checkSocialPreview(html) {
  const name = 'Social preview'
  const ogTitle = metaContent(html, 'og:title')
  const ogImage = metaContent(html, 'og:image')
  const ogDescription = metaContent(html, 'og:description')
  const present = [ogTitle && 'og:title', ogDescription && 'og:description', ogImage && 'og:image'].filter(Boolean)
  if (!present.length) {
    return fail(name, 'No Open Graph tags — links to this site will share with no title, text or image')
  }
  if (!ogImage) return warn(name, `Has ${present.join(', ')} but no og:image, so shared links show no picture`)
  if (present.length < 3) return warn(name, `Only ${present.join(', ')} present`)
  return pass(name, 'og:title, og:description and og:image are all set')
}

function checkStructuredData(html) {
  const name = 'Structured data'
  const blocks = jsonLdBlocks(html)
  if (!blocks.length) {
    return fail(name, 'No JSON-LD structured data — no rich results, no AI answer-engine grounding')
  }
  const types = new Set()
  let invalid = 0
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block)
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        const type = node?.['@type']
        for (const t of Array.isArray(type) ? type : [type]) if (t) types.add(String(t))
      }
    } catch {
      invalid += 1
    }
  }
  if (invalid) {
    return fail(
      name,
      `${invalid} of ${blocks.length} JSON-LD block${blocks.length === 1 ? '' : 's'} contain invalid JSON and are ignored`,
    )
  }
  return pass(name, `${blocks.length} block(s): ${[...types].join(', ') || 'no @type declared'}`)
}

function checkSecurityHeaders(response) {
  const name = 'Security headers'
  if (!response) return fail(name, 'Skipped because the homepage did not respond')
  const missing = []
  if (!response.headers.get('strict-transport-security')) missing.push('Strict-Transport-Security')
  if (!response.headers.get('x-content-type-options')) missing.push('X-Content-Type-Options')
  if (!response.headers.get('content-security-policy')) missing.push('Content-Security-Policy')
  if (!response.headers.get('referrer-policy')) missing.push('Referrer-Policy')
  if (!missing.length) return pass(name, 'HSTS, CSP, nosniff and Referrer-Policy are all set')
  if (missing.length >= 3) return fail(name, `Missing: ${missing.join(', ')}`)
  return warn(name, `Missing: ${missing.join(', ')}`)
}

async function checkRobots(url, opts) {
  const name = 'robots.txt'
  try {
    const { response } = await timedFetch(new URL('/robots.txt', url), { ...opts, accept: 'text/plain' })
    if (response.status === 404) return warn(name, 'No robots.txt — crawlers will guess, and none of your rules apply')
    if (!response.ok) return fail(name, `robots.txt returned HTTP ${response.status}`)
    const text = await response.text()
    // A blanket disallow under the wildcard agent hides the whole site.
    const wildcard = /user-agent:\s*\*/i.test(text)
    const blocksEverything = /^\s*disallow:\s*\/\s*$/im.test(text)
    if (wildcard && blocksEverything) {
      return fail(name, 'robots.txt contains "Disallow: /" — the entire site is blocked from search engines')
    }
    const sitemap = /sitemap:\s*(\S+)/i.exec(text)?.[1] ?? null
    return sitemap
      ? pass(name, `Present, and advertises a sitemap`, { sitemap })
      : warn(name, 'Present but does not declare a Sitemap: line')
  } catch (error) {
    return fail(name, errorMessage(error))
  }
}

async function checkSitemap(url, opts, declaredSitemap) {
  const name = 'Sitemap'
  const candidates = []
  if (declaredSitemap) {
    try {
      candidates.push(new URL(declaredSitemap, url))
    } catch {
      // fall through to the conventional location
    }
  }
  candidates.push(new URL('/sitemap.xml', url))

  for (const candidate of candidates) {
    try {
      const { response } = await timedFetch(candidate, { ...opts, accept: 'application/xml' })
      if (!response.ok) continue
      const xml = await response.text()
      if (!/<(urlset|sitemapindex)\b/i.test(xml)) continue
      if (/<sitemapindex\b/i.test(xml)) {
        const children = (xml.match(/<loc>/gi) ?? []).length
        return { check: pass(name, `Sitemap index listing ${children} sitemap(s)`), urls: [] }
      }
      const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
      if (!urls.length) return { check: fail(name, 'Sitemap is valid XML but lists no URLs'), urls: [] }
      return { check: pass(name, `${urls.length} URL(s) listed`), urls }
    } catch {
      // try the next candidate
    }
  }
  return { check: fail(name, 'No readable sitemap at the declared location or /sitemap.xml'), urls: [] }
}

async function checkNotFound(url, opts) {
  const name = '404 handling'
  // A path nothing could legitimately serve.
  const probe = new URL(`/site-audit-agent-probe-${Date.now().toString(36)}`, url)
  try {
    const { response } = await timedFetch(probe, { ...opts, accept: 'text/html' })
    if (response.status === 404 || response.status === 410) {
      return pass(name, `A missing page correctly returns HTTP ${response.status}`)
    }
    if (response.status >= 300 && response.status < 400) {
      return warn(name, `A missing page redirects (HTTP ${response.status}) instead of returning 404`)
    }
    if (response.ok) {
      return fail(
        name,
        `A missing page returns HTTP ${response.status} instead of 404 — search engines will index infinite junk URLs`,
      )
    }
    return pass(name, `A missing page returns HTTP ${response.status}`)
  } catch (error) {
    return warn(name, errorMessage(error))
  }
}

// ---------------------------------------------------------------------------
// bounded link crawl
// ---------------------------------------------------------------------------

/**
 * Follow internal links breadth-first up to maxPages, recording broken ones and
 * pages missing image alt text. Bounded on purpose: an unbounded crawl of a
 * large catalog is slow, and on a metered host it is also expensive.
 */
async function crawl(entryUrl, entryHtml, opts) {
  const visited = new Map() // href -> status number or 'error'
  const reachable = new Set([entryUrl.href]) // 2xx HTML pages; what the sitemap should list
  const broken = []
  const altProblems = []
  let imagesTotal = 0
  let imagesMissingAltTotal = 0

  const seen = new Set([entryUrl.href])
  const frontier = internalLinks(entryHtml, entryUrl.href).filter((href) => {
    if (seen.has(href)) return false
    seen.add(href)
    return true
  })

  {
    const entryImages = imagesMissingAlt(entryHtml)
    imagesTotal += entryImages.total
    imagesMissingAltTotal += entryImages.missing
    if (entryImages.missing) altProblems.push({ url: entryUrl.href, missing: entryImages.missing })
  }

  while (frontier.length && visited.size < opts.maxPages) {
    // Bound the batch by what is left of the budget, not just by concurrency.
    // Checking the budget inside each task is not enough: the whole batch starts
    // before any of it finishes, so every member would pass a check that only
    // becomes false once they complete.
    const remaining = opts.maxPages - visited.size
    const batch = frontier.splice(0, Math.min(opts.concurrency, remaining))
    await Promise.all(
      batch.map(async (href) => {
        let target
        try {
          target = new URL(href)
        } catch {
          return
        }
        // A link on the audited site could point at an internal address; the
        // entry point being safe does not make every discovered link safe.
        if (!isSafeToFollow(target, { allowPrivate: opts.allowPrivate })) return

        try {
          const { response } = await timedFetch(target, { ...opts, accept: 'text/html' })
          visited.set(href, response.status)
          if (!response.ok) {
            broken.push({ url: href, status: response.status })
            return
          }
          const contentType = response.headers.get('content-type') ?? ''
          if (!contentType.includes('text/html')) return

          reachable.add(href)
          const html = await response.text()
          const images = imagesMissingAlt(html)
          imagesTotal += images.total
          imagesMissingAltTotal += images.missing
          if (images.missing) altProblems.push({ url: href, missing: images.missing })

          if (visited.size < opts.maxPages) {
            for (const link of internalLinks(html, href)) {
              if (!seen.has(link) && seen.size < opts.maxPages * 4) {
                seen.add(link)
                frontier.push(link)
              }
            }
          }
        } catch (error) {
          visited.set(href, 'error')
          broken.push({ url: href, status: errorMessage(error) })
        }
      }),
    )
  }

  return {
    pagesChecked: visited.size + 1,
    linksDiscovered: seen.size,
    reachable,
    broken,
    images: { total: imagesTotal, missingAlt: imagesMissingAltTotal, pages: altProblems },
  }
}

function checkBrokenLinks(crawlResult) {
  const name = 'Internal links'
  const { broken, pagesChecked } = crawlResult
  if (!pagesChecked) return warn(name, 'No internal pages were crawled')
  if (!broken.length) return pass(name, `${pagesChecked} page(s) crawled, no broken internal links`)
  const sample = broken
    .slice(0, 5)
    .map((b) => `${b.url} (${b.status})`)
    .join('; ')
  return fail(name, `${broken.length} broken internal link(s) across ${pagesChecked} page(s): ${sample}`)
}

function checkImageAlt(crawlResult) {
  const name = 'Image alt text'
  const { total, missingAlt } = crawlResult.images
  if (!total) return pass(name, 'No images found on the crawled pages')
  if (!missingAlt) return pass(name, `All ${total} image(s) have an alt attribute`)
  const share = Math.round((missingAlt / total) * 100)
  const detail = `${missingAlt} of ${total} image(s) (${share}%) have no alt attribute`
  return share >= 25 ? fail(name, detail) : warn(name, detail)
}

function checkSitemapAccuracy(sitemapUrls, crawlResult, url) {
  const name = 'Sitemap accuracy'
  if (!sitemapUrls.length) return warn(name, 'Skipped because no sitemap URLs were read')

  const sameOrigin = sitemapUrls.filter((href) => {
    try {
      return new URL(href).origin === url.origin
    } catch {
      return false
    }
  })
  const offOrigin = sitemapUrls.length - sameOrigin.length
  if (offOrigin) {
    return fail(name, `${offOrigin} sitemap URL(s) point at a different origin than the site being audited`)
  }
  // Pages reachable by following links but absent from the sitemap are the
  // actionable gap; a sitemap-only URL may simply be a page we did not crawl
  // within the page budget.
  const inSitemap = new Set(sameOrigin.map((href) => href.replace(/\/$/, '')))
  const orphans = [...crawlResult.reachable].filter((href) => !inSitemap.has(href.replace(/\/$/, '')))
  if (!orphans.length) return pass(name, `All ${crawlResult.pagesChecked} crawled page(s) appear in the sitemap`)
  const share = Math.round((orphans.length / crawlResult.pagesChecked) * 100)
  const detail = `${orphans.length} crawled page(s) (${share}%) are missing from the sitemap: ${orphans
    .slice(0, 5)
    .join('; ')}`
  return share >= 30 ? fail(name, detail) : warn(name, detail)
}

// ---------------------------------------------------------------------------
// public entry point
// ---------------------------------------------------------------------------

/**
 * Audit a website and return a structured report.
 *
 * @param {string} target                  URL or bare hostname
 * @param {object} [options]               overrides for DEFAULTS
 * @returns {Promise<object>} report
 */
export async function auditSite(target, options = {}) {
  const opts = { ...DEFAULTS, ...options }
  const startedAt = Date.now()
  const url = safeTargetUrl(target, { allowPrivate: opts.allowPrivate })

  const checks = []
  const { check: reachable, html, response } = await checkReachable(url, opts)
  checks.push(reachable)

  // Without HTML there is nothing left to inspect; return early rather than
  // emit a dozen misleading "skipped" failures.
  if (!html) {
    return finalize({ url, checks, metrics: {}, startedAt, opts })
  }

  checks.push(checkTls(url, response))
  checks.push(checkTitle(html))
  checks.push(checkMetaDescription(html))
  checks.push(checkCanonical(html, url))
  checks.push(checkViewport(html))
  checks.push(checkSocialPreview(html))
  checks.push(checkStructuredData(html))
  checks.push(checkSecurityHeaders(response))

  const [robots, httpRedirect, notFound] = await Promise.all([
    checkRobots(url, opts),
    checkHttpRedirect(url, opts),
    checkNotFound(url, opts),
  ])
  checks.push(robots, httpRedirect, notFound)

  const { check: sitemapCheck, urls: sitemapUrls } = await checkSitemap(url, opts, robots.sitemap)
  checks.push(sitemapCheck)

  const crawlResult = await crawl(url, html, opts)

  checks.push(checkBrokenLinks(crawlResult))
  checks.push(checkImageAlt(crawlResult))
  checks.push(checkSitemapAccuracy(sitemapUrls, crawlResult, url))

  return finalize({
    url,
    checks,
    metrics: {
      pagesCrawled: crawlResult.pagesChecked,
      linksDiscovered: crawlResult.linksDiscovered,
      brokenLinks: crawlResult.broken.length,
      sitemapUrls: sitemapUrls.length,
      images: crawlResult.images.total,
      imagesMissingAlt: crawlResult.images.missingAlt,
      homepageLatencyMs: reachable.latencyMs ?? null,
    },
    details: { broken: crawlResult.broken.slice(0, 25) },
    startedAt,
    opts,
  })
}

function finalize({ url, checks, metrics, details, startedAt, opts }) {
  const failed = checks.filter((c) => c.status === 'failed')
  const warnings = checks.filter((c) => c.status === 'warning')
  const status = failed.length ? 'unhealthy' : warnings.length ? 'degraded' : 'healthy'

  // A single 0-100 number, because it is the thing a buyer screenshots. A failure
  // costs more than a warning; both are weighted against the number of checks
  // that actually ran so a short audit is not flattered.
  const total = checks.length || 1
  const score = Math.max(0, Math.round(100 - (failed.length * 100) / total - (warnings.length * 40) / total))

  const summary = failed.length
    ? `${failed.length} problem${failed.length === 1 ? '' : 's'} to fix${
        warnings.length ? ` and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''
      }`
    : warnings.length
      ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}, nothing critical`
      : `All ${checks.length} checks passed`

  return {
    target: url.href,
    status,
    score,
    summary,
    checks,
    metrics: metrics ?? {},
    details: details ?? {},
    durationMs: Date.now() - startedAt,
    engine: { name: 'site-audit-agent', version: '1.0.0', maxPages: opts.maxPages },
  }
}

export { DEFAULTS }
