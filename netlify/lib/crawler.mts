// Discovery crawler for the storefront.
//
// Where site-health.mts pings a handful of known endpoints to answer "is the
// site up?", this library answers a different question: "if a search engine
// started at the homepage and followed links, would it actually discover every
// page we care about?" It walks the internal link graph the way a crawler does,
// then reconciles three separate discovery surfaces against each other:
//
//   1. the link graph  — what's reachable by following <a href> from the home page
//   2. the sitemap     — what /sitemap.xml advertises to crawlers
//   3. the catalog     — every live product that *should* have an indexable page
//
// A page that's live but unlinked, in the sitemap but orphaned, or a product
// with no crawlable page are all "discovery gaps" a plain uptime check misses.
// The result is a DiscoveryReport shaped like site-health's HealthReport so the
// scheduled bot and the read endpoint can treat both the same way.

export type CheckStatus = 'passed' | 'warning' | 'failed'
export type CrawlStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface DiscoveryCheck {
  name: string
  status: CheckStatus
  detail: string
}

export interface CrawlMetrics {
  pagesCrawled: number
  linkedPaths: number // internal paths found as links, whether or not they were fetched
  crawlTruncated: boolean // the fetch budget ran out before the frontier drained
  reachable: number
  brokenLinks: number
  indexablePages: number
  maxDepth: number
  sitemapUrls: number
  sitemapCoverage: number // % of crawlable pages also listed in the sitemap
  orphanSitemapUrls: number // in sitemap but not reachable by following links
  unlistedPages: number // reachable by crawling but missing from the sitemap
  catalogProducts: number
  productsDiscoverable: number // products reached by following links
  productsInSitemap: number
}

export interface DiscoveryReport {
  status: CrawlStatus
  summary: string
  checks: DiscoveryCheck[]
  metrics: CrawlMetrics
  issues: string[] // concrete, human-readable discovery gaps (bounded list)
  durationMs: number
}

// Hard cap on crawl breadth. Every page in this budget is a live request back
// through our own edge functions and API routes, so the cap is a direct cap on
// what one crawl costs. It was 120 — triple the headroom needed, and triple the
// bill if a link loop ever fed the frontier.
//
// The catalog alone is larger than this, which is fine: the budget bounds what
// gets *fetched*, and the checks below reason about what is *linked*. Raising it
// buys more sampled pages, not a more accurate discovery report.
const MAX_PAGES = 60
// Backstop on link discovery, which is just strings and costs no requests. It
// exists so a pathological link loop cannot grow the frontier without bound.
const MAX_DISCOVERED = 5000
const CONCURRENCY = 6
const REQUEST_TIMEOUT_MS = 5000
const MAX_ISSUES = 25 // keep the persisted issue list bounded
const CRAWLER_UA = 'MULTINICHE-discovery-crawler/1.0'

// Assets and non-page routes we never treat as crawlable HTML pages.
const SKIP_EXT = /\.(png|jpe?g|svg|ico|webp|gif|avif|css|mjs|js|json|xml|webmanifest|txt|pdf|woff2?|ttf|map)$/i

interface PageResult {
  path: string
  depth: number
  status: number
  ok: boolean
  html: boolean
  title: boolean
  description: boolean
  canonical: boolean
  noindex: boolean
  jsonLd: boolean
  links: string[]
}

interface CrawlWalk {
  results: Map<string, PageResult>
  linked: Set<string> // every internal path found as a link, fetched or not
  truncated: boolean // the fetch budget stopped the walk before the frontier drained
}

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

// Resolve an href against the page it was found on and reduce it to a canonical
// same-origin path (query string and fragment dropped so /?product=X and /#top
// both dedupe to /). Returns null for anything we should not crawl.
function normalizePath(href: string, base: string, origin: string): string | null {
  try {
    const u = new URL(href, base)
    if (u.origin !== origin) return null
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const path = u.pathname
    if (path.startsWith('/api/') || path.startsWith('/.netlify/') || path.startsWith('/.well-known/')) return null
    if (SKIP_EXT.test(path)) return null
    return path
  } catch {
    return null
  }
}

function extractLinks(html: string, base: string, origin: string): string[] {
  const out = new Set<string>()
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const path = normalizePath(match[1], base, origin)
    if (path) out.add(path)
  }
  return [...out]
}

// Meta content lookup tolerant of attribute order (name-then-content or the
// reverse), which real HTML uses interchangeably.
function metaContent(html: string, name: string): string | null {
  const a = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)
  if (a) return a[1]
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i').exec(html)
  return b ? b[1] : null
}

function parseHtml(html: string, base: string, origin: string) {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const description = metaContent(html, 'description')
  const robots = metaContent(html, 'robots') ?? ''
  return {
    title: Boolean(titleMatch && titleMatch[1].trim()),
    description: Boolean(description && description.trim()),
    canonical: /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html),
    noindex: /noindex/i.test(robots),
    jsonLd: /application\/ld\+json/i.test(html),
    links: extractLinks(html, base, origin),
  }
}

async function fetchPage(path: string, depth: number, origin: string): Promise<PageResult> {
  const url = new URL(path, origin)
  const base = {
    path,
    depth,
    status: 0,
    ok: false,
    html: false,
    title: false,
    description: false,
    canonical: false,
    noindex: false,
    jsonLd: false,
    links: [] as string[],
  }
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html', 'user-agent': CRAWLER_UA },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    base.status = response.status
    base.ok = response.ok
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.includes('text/html')) {
      // Drain the body so the connection can be reused.
      await response.text().catch(() => '')
      return base
    }
    base.html = true
    const html = await response.text()
    Object.assign(base, parseHtml(html, url.href, origin))
    return base
  } catch (error) {
    base.status = base.status || 0
    return base
  }
}

// Breadth-first walk of the internal link graph starting at the homepage.
//
// Two different sets come out of this, and conflating them is what made every
// crawl of a catalog larger than the budget report most of the store as
// unreachable:
//
//   results — pages actually fetched. Bounded by MAX_PAGES, because each one is
//             a live request back through our own edge functions.
//   linked  — every internal path *discovered as a link*, fetched or not. A path
//             in here is linked from somewhere on the site by definition, which
//             is the only question the sitemap and catalog checks are asking.
//
// A page that is linked but unvisited is a budget outcome, not a site defect,
// and the report has to be able to tell those apart.
async function crawl(origin: string): Promise<CrawlWalk> {
  const results = new Map<string, PageResult>()
  const linked = new Set<string>(['/'])
  let frontier: Array<{ path: string; depth: number }> = [{ path: '/', depth: 0 }]

  while (frontier.length && results.size < MAX_PAGES) {
    const batch = frontier.splice(0, CONCURRENCY)
    const pages = await Promise.all(batch.map(({ path, depth }) => fetchPage(path, depth, origin)))
    const next: Array<{ path: string; depth: number }> = []
    for (const page of pages) {
      results.set(page.path, page)
      for (const link of page.links) {
        // Discovery is deliberately not capped at MAX_PAGES. It was, which meant
        // the set of known-linked paths could never grow past the fetch budget
        // and everything beyond it looked orphaned. MAX_DISCOVERED is a much
        // larger backstop against a link loop, not a crawl budget.
        if (!linked.has(link) && linked.size < MAX_DISCOVERED) {
          linked.add(link)
          next.push({ path: link, depth: page.depth + 1 })
        }
      }
    }
    frontier = frontier.concat(next)
  }

  // Anything still queued was linked and reachable; we simply stopped paying to
  // fetch it.
  return { results, linked, truncated: frontier.length > 0 || results.size >= MAX_PAGES }
}


async function fetchSitemapPaths(origin: string): Promise<Set<string> | null> {
  try {
    const response = await fetch(new URL('/sitemap.xml', origin), {
      headers: { accept: 'application/xml', 'user-agent': CRAWLER_UA },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const xml = await response.text()
    const paths = new Set<string>()
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(xml)) !== null) {
      try {
        paths.add(new URL(match[1]).pathname)
      } catch {
        /* ignore malformed loc */
      }
    }
    return paths
  } catch {
    return null
  }
}

async function fetchCatalogSkus(origin: string): Promise<string[] | null> {
  try {
    const response = await fetch(new URL('/api/products', origin), {
      headers: { accept: 'application/json', 'user-agent': CRAWLER_UA },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { products?: Array<{ sku?: unknown }> }
    const skus = (Array.isArray(data.products) ? data.products : [])
      .map((p) => (typeof p.sku === 'string' ? p.sku : null))
      .filter((s): s is string => Boolean(s))
    return skus
  } catch {
    return null
  }
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 100
  return Math.round((part / whole) * 100)
}

export async function crawlSite(origin: string): Promise<DiscoveryReport> {
  const startedAt = performance.now()

  // Kick the crawl off alongside the sitemap + catalog fetches; the walk is the
  // long pole, so the reference data is ready by the time it finishes.
  const [walk, sitemap, skus] = await Promise.all([
    crawl(origin),
    fetchSitemapPaths(origin),
    fetchCatalogSkus(origin),
  ])

  const pages = walk.results
  const checks: DiscoveryCheck[] = []
  const issues: string[] = []
  const addIssue = (msg: string) => {
    if (issues.length < MAX_ISSUES) issues.push(msg)
  }

  const allPages = [...pages.values()]
  const reachablePages = allPages.filter((p) => p.ok && p.html)
  const brokenPages = allPages.filter((p) => !p.ok)
  const indexablePages = reachablePages.filter((p) => !p.noindex)
  const maxDepth = allPages.reduce((max, p) => Math.max(max, p.depth), 0)

  // Reachability and Indexability can only speak for pages that were actually
  // fetched. When the budget cut the walk short, the detail has to say so —
  // otherwise "All 60 linked pages loaded" reads as a clean bill of health for
  // the whole site when it is really a clean bill of health for a sample.
  const sampled = walk.truncated
    ? ` (sample: the crawl stopped after ${allPages.length} of ${walk.linked.size} linked pages)`
    : ''

  // 1. Reachability — internal links that a crawler followed but that failed.
  if (brokenPages.length) {
    checks.push({
      name: 'Reachability',
      status: 'failed',
      detail: `${brokenPages.length} internal link${brokenPages.length === 1 ? '' : 's'} did not load`,
    })
    for (const p of brokenPages) addIssue(`Broken link: ${p.path} (HTTP ${p.status || 'no response'})`)
  } else {
    checks.push({
      name: 'Reachability',
      status: 'passed',
      detail: `All ${reachablePages.length} crawled pages loaded${sampled}`,
    })
  }

  // 2. Indexability — reachable pages missing the SEO essentials crawlers need,
  //    or explicitly marked noindex.
  const missingSeo = reachablePages.filter((p) => !p.title || !p.description || !p.canonical)
  const noindexed = reachablePages.filter((p) => p.noindex)
  if (missingSeo.length) {
    checks.push({
      name: 'Indexability',
      status: 'failed',
      detail: `${missingSeo.length} page${missingSeo.length === 1 ? '' : 's'} missing title, description, or canonical`,
    })
    for (const p of missingSeo) {
      const gaps = [!p.title && 'title', !p.description && 'description', !p.canonical && 'canonical']
        .filter(Boolean)
        .join(', ')
      addIssue(`Incomplete SEO on ${p.path}: missing ${gaps}`)
    }
  } else if (noindexed.length) {
    checks.push({
      name: 'Indexability',
      status: 'warning',
      detail: `${noindexed.length} reachable page${noindexed.length === 1 ? '' : 's'} marked noindex`,
    })
    for (const p of noindexed) addIssue(`Page marked noindex: ${p.path}`)
  } else {
    checks.push({
      name: 'Indexability',
      status: 'passed',
      detail: `All ${reachablePages.length} pages are indexable with complete metadata${sampled}`,
    })
  }

  // 3. Sitemap coverage — reconcile the link graph against /sitemap.xml.
  let orphanSitemapUrls = 0
  let unlistedPages = 0
  let sitemapUrls = 0
  if (!sitemap) {
    checks.push({ name: 'Sitemap coverage', status: 'failed', detail: 'Sitemap could not be fetched' })
    addIssue('Sitemap: /sitemap.xml did not respond')
  } else {
    sitemapUrls = sitemap.size
    // "Reachable" means linked, not visited. A sitemap URL the walk found a link
    // to is discoverable whether or not the budget stretched far enough to fetch
    // it; only a URL nothing links to is genuinely orphaned.
    const orphans = [...sitemap].filter((path) => !walk.linked.has(path))
    const unlisted = indexablePages.filter((p) => !sitemap.has(p.path))
    orphanSitemapUrls = orphans.length
    unlistedPages = unlisted.length

    if (orphans.length || unlisted.length) {
      checks.push({
        name: 'Sitemap coverage',
        status: 'warning',
        detail:
          `${orphans.length} sitemap URL${orphans.length === 1 ? '' : 's'} not linked from anywhere on the site; ` +
          `${unlisted.length} crawlable page${unlisted.length === 1 ? '' : 's'} missing from the sitemap`,
      })
      for (const path of orphans) addIssue(`Orphaned (in sitemap, not linked from the site): ${path}`)
      for (const p of unlisted) addIssue(`Crawlable but not in sitemap: ${p.path}`)
    } else {
      checks.push({
        name: 'Sitemap coverage',
        status: 'passed',
        detail: `Sitemap and link graph agree on ${sitemap.size} URLs`,
      })
    }
  }

  // 4. Catalog discovery — the core check. Every live product must have a
  //    product page a crawler can actually reach, and be in the sitemap.
  const catalogProducts = skus?.length ?? 0
  let productsDiscoverable = 0
  let productsInSitemap = 0
  if (!skus) {
    checks.push({ name: 'Catalog discovery', status: 'failed', detail: 'Catalog could not be fetched' })
    addIssue('Catalog: /api/products did not respond')
  } else if (catalogProducts === 0) {
    checks.push({ name: 'Catalog discovery', status: 'warning', detail: 'Catalog returned no products to check' })
  } else {
    const undiscoverable: string[] = []
    const notInSitemap: string[] = []
    for (const sku of skus) {
      const productPath = `/product/${encodeURIComponent(sku)}`
      // Same distinction as the sitemap check: a product page linked from its
      // /tools/:niche listing is discoverable even when the crawl budget ran out
      // before reaching it. Counting only fetched pages here reported most of
      // the catalog as unreachable on every run once the catalog outgrew
      // MAX_PAGES, which is a false alarm that hid real ones.
      if (walk.linked.has(productPath)) productsDiscoverable++
      else undiscoverable.push(sku)
      if (sitemap?.has(productPath)) productsInSitemap++
      else if (sitemap) notInSitemap.push(sku)
    }
    if (undiscoverable.length) {
      checks.push({
        name: 'Catalog discovery',
        status: 'failed',
        detail: `${undiscoverable.length} of ${catalogProducts} product${catalogProducts === 1 ? '' : 's'} not reachable by following links`,
      })
      for (const sku of undiscoverable) addIssue(`Product not discoverable via internal links: ${sku}`)
      for (const sku of notInSitemap) addIssue(`Product missing from sitemap: ${sku}`)
    } else if (notInSitemap.length) {
      checks.push({
        name: 'Catalog discovery',
        status: 'warning',
        detail: `All products are linked, but ${notInSitemap.length} ${notInSitemap.length === 1 ? 'is' : 'are'} missing from the sitemap`,
      })
      for (const sku of notInSitemap) addIssue(`Product missing from sitemap: ${sku}`)
    } else {
      checks.push({
        name: 'Catalog discovery',
        status: 'passed',
        detail: `All ${catalogProducts} products are reachable by crawling and listed in the sitemap`,
      })
    }
  }

  const failures = checks.filter((c) => c.status === 'failed').length
  const warnings = checks.filter((c) => c.status === 'warning').length
  const status: CrawlStatus = failures ? 'unhealthy' : warnings ? 'degraded' : 'healthy'
  const summary = failures
    ? `${failures} discovery gap${failures === 1 ? '' : 's'} found`
    : warnings
      ? `${warnings} discovery warning${warnings === 1 ? '' : 's'} detected`
      : `Fully discoverable: ${walk.linked.size} linked pages found, ${reachablePages.length} crawled, all ${catalogProducts} products reachable`

  const metrics: CrawlMetrics = {
    pagesCrawled: allPages.length,
    linkedPaths: walk.linked.size,
    crawlTruncated: walk.truncated,
    reachable: reachablePages.length,
    brokenLinks: brokenPages.length,
    indexablePages: indexablePages.length,
    maxDepth,
    sitemapUrls,
    sitemapCoverage: sitemap ? pct(indexablePages.filter((p) => sitemap.has(p.path)).length, indexablePages.length) : 0,
    orphanSitemapUrls,
    unlistedPages,
    catalogProducts,
    productsDiscoverable,
    productsInSitemap,
  }

  return { status, summary, checks, metrics, issues, durationMs: elapsed(startedAt) }
}
