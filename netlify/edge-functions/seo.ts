// Edge function: inject fresh, complete structured data into the homepage.
//
// Crawlers (Google, Bing) and AI answer engines (ChatGPT, Perplexity, Gemini)
// read the HTML that arrives in the first response — they do not run the client
// JS that fetches /api/products. So the hand-written JSON-LD in index.html would
// otherwise drift from the real catalog the moment a product is added or its
// price changes.
//
// This function fetches the live catalog and rewrites the block marked by
// <!-- SEO_JSONLD_START --> ... <!-- SEO_JSONLD_END --> with an accurate
// ItemList of Product offers (SKU, price, availability, category, deep-link
// URL). If anything goes wrong the original HTML — including its static
// fallback ItemList — is served unchanged.

import type { Context, Config } from '@netlify/edge-functions'

const SITE = 'https://jblessd.com'
const START = '<!-- SEO_JSONLD_START'
const END = '<!-- SEO_JSONLD_END -->'

// The catalog fetch is a same-origin subrequest to /api/products, which spins up
// a serverless function and a Postgres connection. On a cold path that can take
// a couple of seconds, and this edge function blocks the whole homepage response
// on it. Crawlers (Bingbot in particular) enforce a stricter fetch timeout than
// browsers, so a slow subrequest shows up as "Page fetch failed" in Bing even
// though the site loads fine in a browser. Bounding the wait guarantees a prompt
// response: if the live catalog isn't back in time we serve the static fallback
// ItemList that already ships in index.html.
const CATALOG_TIMEOUT_MS = 1200

const CATEGORY_LABEL: Record<string, string> = {
  prompts: 'Prompt Packs',
  automations: 'Automation Blueprints',
  templates: 'Doc Templates',
  agents: 'Agent Configs',
}

interface ApiProduct {
  sku: string
  name: string
  category: string
  price: number
  blurb: string
  catLabel?: string
}

// JSON embedded in HTML must not contain a literal "</script>" or a raw "<".
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// These tools are digital goods delivered instantly by download, so shipping is
// free with no handling or transit time. The return policy accurately states
// that returns are not permitted after delivery while linking to the exceptions
// for failed delivery, defective files, duplicate charges, or misdescription.
const OFFER_VALID_FROM = '2025-01-01'

const SHIPPING_DETAILS = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'USD' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
  },
}

const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
  merchantReturnLink: `${SITE}/refund-policy/`,
}

interface ReviewSample {
  author: string
  rating: number
  body: string
  createdAt: string | null
}
interface Aggregate {
  count: number
  average: number
  sample?: ReviewSample
}

function buildItemList(products: ApiProduct[], aggregates: Record<string, Aggregate>): string {
  const itemListElement = products.map((p, i) => {
    const url = `${SITE}/product/${encodeURIComponent(p.sku)}`
    const item: Record<string, unknown> = {
      '@type': 'Product',
      name: p.name,
      sku: p.sku,
      category: p.catLabel ?? CATEGORY_LABEL[p.category] ?? p.category,
      description: p.blurb,
      brand: { '@type': 'Brand', name: 'MULTINICHE AI' },
      image: `${SITE}/og-image.png`,
      url,
      offers: {
        '@type': 'Offer',
        price: Number(p.price).toFixed(2),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url,
        priceValidUntil: '2027-12-31',
        validFrom: OFFER_VALID_FROM,
        shippingDetails: SHIPPING_DETAILS,
        hasMerchantReturnPolicy: RETURN_POLICY,
      },
    }
    const agg = aggregates[p.sku]
    if (agg && agg.count > 0) {
      item.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: agg.average,
        reviewCount: agg.count,
        bestRating: 5,
        worstRating: 1,
      }
      if (agg.sample) {
        item.review = [
          {
            '@type': 'Review',
            author: { '@type': 'Person', name: agg.sample.author },
            reviewRating: { '@type': 'Rating', ratingValue: agg.sample.rating, bestRating: 5, worstRating: 1 },
            reviewBody: agg.sample.body,
            ...(agg.sample.createdAt ? { datePublished: agg.sample.createdAt.slice(0, 10) } : {}),
          },
        ]
      }
    }
    return { '@type': 'ListItem', position: i + 1, item }
  })

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'MULTINICHE AI — full catalog',
    numberOfItems: products.length,
    itemListElement,
  }

  return (
    `${START}: live catalog injected by the seo edge function. -->\n` +
    `<script type="application/ld+json">\n${safeJson(itemList)}\n</script>\n` +
    END
  )
}

// Best-effort fetch of review aggregates so the catalog markup can carry star
// ratings. Never blocks the response for long — falls back to no ratings.
async function fetchAggregates(req: Request): Promise<Record<string, Aggregate>> {
  try {
    const res = await fetch(new URL('/api/reviews', req.url), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    })
    if (!res.ok) return {}
    const data = (await res.json()) as { aggregates?: Record<string, Aggregate> }
    return data.aggregates ?? {}
  } catch {
    return {}
  }
}

export default async (req: Request, context: Context) => {
  const res = await context.next()
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return res

  let html = await res.text()

  try {
    const apiUrl = new URL('/api/products', req.url)
    // Kick off the ratings fetch in parallel with the catalog fetch so the
    // homepage render waits on the slower of the two, not the sum — crawlers
    // (Bingbot especially) enforce a strict fetch timeout on this page.
    const aggregatesPromise = fetchAggregates(req)
    const apiRes = await fetch(apiUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    })
    if (apiRes.ok) {
      const data = (await apiRes.json()) as { products?: ApiProduct[] }
      const products = Array.isArray(data.products) ? data.products : []
      const aggregates = await aggregatesPromise
      const startIdx = html.indexOf(START)
      const endIdx = html.indexOf(END)
      if (products.length && startIdx !== -1 && endIdx !== -1) {
        html =
          html.slice(0, startIdx) +
          buildItemList(products, aggregates) +
          html.slice(endIdx + END.length)
      }
    }
  } catch (err) {
    // Leave the static fallback ItemList in place.
    console.error('seo edge function:', (err as Error).message)
  }

  const headers = new Headers(res.headers)
  headers.delete('content-length')
  return new Response(html, { status: res.status, statusText: res.statusText, headers })
}

export const config: Config = {
  path: ['/', '/index.html'],
}
