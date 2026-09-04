export type CheckStatus = 'passed' | 'warning' | 'failed'
export type SiteStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface HealthCheck {
  name: string
  status: CheckStatus
  latencyMs: number
  detail: string
}

export interface HealthReport {
  status: SiteStatus
  summary: string
  checks: HealthCheck[]
  durationMs: number
}

const REQUEST_TIMEOUT_MS = 5000
// Observed homepage latency straddles the old 2500ms line (seen anywhere from
// ~400ms to ~2700ms run to run), which made this check flip passed/warning on
// ordinary variance rather than a real slowdown — and each flip changed the
// diagnosis fingerprint, forcing a fresh LLM call in agent-diagnosis.mts for
// what wasn't actually a new problem. 3200ms gives headroom above normal
// variance while still catching genuine slowness.
const SLOW_RESPONSE_MS = 3200

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function passed(name: string, latencyMs: number, detail: string): HealthCheck {
  return {
    name,
    status: latencyMs > SLOW_RESPONSE_MS ? 'warning' : 'passed',
    latencyMs,
    detail: latencyMs > SLOW_RESPONSE_MS ? `${detail}; response is slower than ${SLOW_RESPONSE_MS}ms` : detail,
  }
}

function failed(name: string, latencyMs: number, detail: string): HealthCheck {
  return { name, status: 'failed', latencyMs, detail }
}

function warned(name: string, latencyMs: number, detail: string): HealthCheck {
  return { name, status: 'warning', latencyMs, detail }
}

async function fetchWithTimeout(url: URL, accept: string): Promise<{ response: Response; latencyMs: number }> {
  const startedAt = performance.now()
  const response = await fetch(url, {
    headers: { accept, 'user-agent': 'MULTINICHE-site-maintenance/1.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return { response, latencyMs: elapsed(startedAt) }
}

async function checkHomepage(origin: string): Promise<HealthCheck> {
  const name = 'Storefront'
  const startedAt = performance.now()
  try {
    const { response, latencyMs } = await fetchWithTimeout(new URL('/', origin), 'text/html')
    if (!response.ok) return failed(name, latencyMs, `HTTP ${response.status}`)
    const html = await response.text()
    if (!html.includes('MULTINICHE AI')) return failed(name, latencyMs, 'Expected storefront content is missing')
    if (!html.includes('application/ld+json')) return failed(name, latencyMs, 'Structured data is missing')
    return passed(name, latencyMs, 'Homepage and structured data are available')
  } catch (error) {
    return failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed')
  }
}

async function checkProducts(origin: string): Promise<{ check: HealthCheck; skus: string[] }> {
  const name = 'Catalog API'
  const startedAt = performance.now()
  try {
    const { response, latencyMs } = await fetchWithTimeout(new URL('/api/products', origin), 'application/json')
    if (!response.ok) {
      return { check: failed(name, latencyMs, `HTTP ${response.status}`), skus: [] }
    }
    const data = (await response.json()) as { products?: Array<{ sku?: unknown }> }
    const products = Array.isArray(data.products) ? data.products : []
    const skus = products.map((p) => p.sku).filter((sku): sku is string => typeof sku === 'string')
    if (!skus.length) {
      return { check: failed(name, latencyMs, 'Catalog returned no valid products'), skus: [] }
    }
    return {
      check: passed(name, latencyMs, `${products.length} products available`),
      skus,
    }
  } catch (error) {
    return {
      check: failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed'),
      skus: [],
    }
  }
}

async function checkReviews(origin: string): Promise<{ check: HealthCheck; rated: Set<string> }> {
  const name = 'Review data'
  const startedAt = performance.now()
  try {
    const { response, latencyMs } = await fetchWithTimeout(new URL('/api/reviews', origin), 'application/json')
    if (!response.ok) return { check: failed(name, latencyMs, `HTTP ${response.status}`), rated: new Set() }
    const data = (await response.json()) as { aggregates?: Record<string, { count?: unknown }> }
    const aggregates = data.aggregates && typeof data.aggregates === 'object' ? data.aggregates : {}
    const rated = new Set(Object.entries(aggregates).filter(([, entry]) => Number(entry?.count) > 0).map(([sku]) => sku))
    if (!rated.size) return { check: failed(name, latencyMs, 'No product ratings are available'), rated }
    return { check: passed(name, latencyMs, `${rated.size} products have ratings`), rated }
  } catch (error) {
    return {
      check: failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed'),
      rated: new Set(),
    }
  }
}

async function checkSitemap(origin: string): Promise<HealthCheck> {
  const name = 'Sitemap'
  const startedAt = performance.now()
  try {
    const { response, latencyMs } = await fetchWithTimeout(new URL('/sitemap.xml', origin), 'application/xml')
    if (!response.ok) return failed(name, latencyMs, `HTTP ${response.status}`)
    const xml = await response.text()
    if (!xml.includes('<urlset') || !xml.includes('/product/')) {
      return failed(name, latencyMs, 'Sitemap does not include product pages')
    }
    return passed(name, latencyMs, 'Product URLs are discoverable')
  } catch (error) {
    return failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed')
  }
}

// Verifies that a product page really does carry rating and review markup.
//
// The SKU to sample has to be one that *has* reviews. Sampling the first
// catalog product regardless meant that the moment a newly added, not-yet
// reviewed product sorted to the front, this check failed with "aggregateRating
// markup is missing" — reporting the storefront as broken because a product was
// new. pages.ts deliberately omits aggregateRating when the review count is
// zero (emitting one with count 0 is invalid structured data and Google rejects
// it), so its absence there is the correct behaviour, not a defect.
async function checkProductSchema(origin: string, sku: string | null): Promise<HealthCheck> {
  const name = 'Product review schema'
  if (!sku) return warned(name, 0, 'Skipped: no product has reviews yet, so there is no rating markup to verify')

  const startedAt = performance.now()
  try {
    const url = new URL(`/product/${encodeURIComponent(sku)}`, origin)
    const { response, latencyMs } = await fetchWithTimeout(url, 'text/html')
    if (!response.ok) return failed(name, latencyMs, `HTTP ${response.status}`)
    const html = await response.text()
    if (!html.includes('aggregateRating')) return failed(name, latencyMs, 'aggregateRating markup is missing')
    if (!html.includes('"review"')) return failed(name, latencyMs, 'review markup is missing')
    return passed(name, latencyMs, `Rating and review markup are present for ${sku}`)
  } catch (error) {
    return failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed')
  }
}

export async function inspectSite(origin: string): Promise<HealthReport> {
  const startedAt = performance.now()
  const [homepage, catalog, reviews, sitemap] = await Promise.all([
    checkHomepage(origin),
    checkProducts(origin),
    checkReviews(origin),
    checkSitemap(origin),
  ])
  // A product nobody has reviewed yet is a content gap, not an outage. This used
  // to flip the whole check to `failed`, which made the site read as unhealthy —
  // and, because failures are what get sent to the model for a repair
  // recommendation, produced confident advice about fixing "missing ratings
  // data" that no code change could satisfy. Nothing is broken: pages.ts only
  // emits an aggregateRating when the count is above zero, so an unreviewed
  // product renders correctly and its structured data stays valid. It is a
  // warning, and it names the products so the owner can go collect reviews for
  // exactly those.
  //
  // The one shape here that *is* a real failure is aggregates existing while not
  // one of them matches a catalog SKU — that means the two datasets have drifted
  // apart (a renamed SKU, a stale review table) and every rating on the site is
  // being attached to nothing.
  if (catalog.skus.length && reviews.check.status !== 'failed') {
    const ratedInCatalog = catalog.skus.filter((sku) => reviews.rated.has(sku))
    const unrated = catalog.skus.filter((sku) => !reviews.rated.has(sku))
    if (!ratedInCatalog.length) {
      reviews.check = failed(
        reviews.check.name,
        reviews.check.latencyMs,
        `${reviews.rated.size} review aggregate${reviews.rated.size === 1 ? '' : 's'} exist but none match a catalog SKU`,
      )
    } else if (unrated.length) {
      const named = unrated.slice(0, 5).join(', ')
      reviews.check = warned(
        reviews.check.name,
        reviews.check.latencyMs,
        `${ratedInCatalog.length} of ${catalog.skus.length} products have ratings; no reviews yet for ${named}` +
          (unrated.length > 5 ? ` and ${unrated.length - 5} more` : ''),
      )
    }
  }
  // Sample a product that actually has ratings — see checkProductSchema. When
  // none does, the check is skipped rather than failed: the review check above
  // has already said why (no ratings anywhere, or the review API is down), and
  // failing here as well would report the same single problem twice.
  const productSchema = await checkProductSchema(
    origin,
    catalog.skus.find((sku) => reviews.rated.has(sku)) ?? null,
  )
  const checks = [homepage, catalog.check, reviews.check, productSchema, sitemap]
  const failures = checks.filter((check) => check.status === 'failed').length
  const warnings = checks.filter((check) => check.status === 'warning').length
  const status: SiteStatus = failures ? 'unhealthy' : warnings ? 'degraded' : 'healthy'
  const summary = failures
    ? `${failures} critical check${failures === 1 ? '' : 's'} failed`
    : warnings
      ? `${warnings} performance warning${warnings === 1 ? '' : 's'} detected`
      : `All ${checks.length} storefront checks passed`

  return { status, summary, checks, durationMs: elapsed(startedAt) }
}
