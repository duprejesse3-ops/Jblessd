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
const SLOW_RESPONSE_MS = 2500

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

async function fetchWithTimeout(url: URL, accept: string): Promise<{ response: Response; latencyMs: number }> {
  const startedAt = performance.now()
  const response = await fetch(url, {
    headers: { accept, 'user-agent': 'MULTI-VICE-site-maintenance/1.0' },
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
    if (!html.includes('MULTI-VICE AI')) return failed(name, latencyMs, 'Expected storefront content is missing')
    if (!html.includes('application/ld+json')) return failed(name, latencyMs, 'Structured data is missing')
    return passed(name, latencyMs, 'Homepage and structured data are available')
  } catch (error) {
    return failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed')
  }
}

async function checkProducts(origin: string): Promise<{ check: HealthCheck; firstSku: string | null; count: number }> {
  const name = 'Catalog API'
  const startedAt = performance.now()
  try {
    const { response, latencyMs } = await fetchWithTimeout(new URL('/api/products', origin), 'application/json')
    if (!response.ok) return { check: failed(name, latencyMs, `HTTP ${response.status}`), firstSku: null, count: 0 }
    const data = (await response.json()) as { products?: Array<{ sku?: unknown }> }
    const products = Array.isArray(data.products) ? data.products : []
    const firstSku = typeof products[0]?.sku === 'string' ? products[0].sku : null
    if (!products.length || !firstSku) {
      return { check: failed(name, latencyMs, 'Catalog returned no valid products'), firstSku: null, count: 0 }
    }
    return {
      check: passed(name, latencyMs, `${products.length} products available`),
      firstSku,
      count: products.length,
    }
  } catch (error) {
    return {
      check: failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed'),
      firstSku: null,
      count: 0,
    }
  }
}

async function checkReviews(origin: string): Promise<{ check: HealthCheck; ratedProducts: number }> {
  const name = 'Review data'
  const startedAt = performance.now()
  try {
    const { response, latencyMs } = await fetchWithTimeout(new URL('/api/reviews', origin), 'application/json')
    if (!response.ok) return { check: failed(name, latencyMs, `HTTP ${response.status}`), ratedProducts: 0 }
    const data = (await response.json()) as { aggregates?: Record<string, { count?: unknown }> }
    const aggregates = data.aggregates && typeof data.aggregates === 'object' ? data.aggregates : {}
    const ratedProducts = Object.values(aggregates).filter((entry) => Number(entry?.count) > 0).length
    if (!ratedProducts) return { check: failed(name, latencyMs, 'No product ratings are available'), ratedProducts: 0 }
    return { check: passed(name, latencyMs, `${ratedProducts} products have ratings`), ratedProducts }
  } catch (error) {
    return {
      check: failed(name, elapsed(startedAt), error instanceof Error ? error.message : 'Request failed'),
      ratedProducts: 0,
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

async function checkProductSchema(origin: string, sku: string | null): Promise<HealthCheck> {
  const name = 'Product review schema'
  if (!sku) return failed(name, 0, 'Skipped because no catalog product was available')

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
  if (catalog.count > 0 && reviews.check.status !== 'failed' && reviews.ratedProducts < catalog.count) {
    reviews.check = failed(
      reviews.check.name,
      reviews.check.latencyMs,
      `${catalog.count - reviews.ratedProducts} catalog product${catalog.count - reviews.ratedProducts === 1 ? '' : 's'} missing ratings`,
    )
  }
  const productSchema = await checkProductSchema(origin, catalog.firstSku)
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
