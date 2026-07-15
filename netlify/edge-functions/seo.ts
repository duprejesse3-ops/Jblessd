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

function buildItemList(products: ApiProduct[]): string {
  const itemListElement = products.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Product',
      name: p.name,
      sku: p.sku,
      category: p.catLabel ?? CATEGORY_LABEL[p.category] ?? p.category,
      description: p.blurb,
      brand: { '@type': 'Brand', name: 'THE CONSTRUCT AI' },
      image: `${SITE}/og-image.png`,
      url: `${SITE}/?product=${encodeURIComponent(p.sku)}`,
      offers: {
        '@type': 'Offer',
        price: Number(p.price).toFixed(2),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE}/?product=${encodeURIComponent(p.sku)}`,
        priceValidUntil: '2027-12-31',
      },
    },
  }))

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'THE CONSTRUCT AI — full catalog',
    numberOfItems: products.length,
    itemListElement,
  }

  return (
    `${START}: live catalog injected by the seo edge function. -->\n` +
    `<script type="application/ld+json">\n${safeJson(itemList)}\n</script>\n` +
    END
  )
}

export default async (req: Request, context: Context) => {
  const res = await context.next()
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return res

  let html = await res.text()

  try {
    const apiUrl = new URL('/api/products', req.url)
    const apiRes = await fetch(apiUrl, { headers: { accept: 'application/json' } })
    if (apiRes.ok) {
      const data = (await apiRes.json()) as { products?: ApiProduct[] }
      const products = Array.isArray(data.products) ? data.products : []
      const startIdx = html.indexOf(START)
      const endIdx = html.indexOf(END)
      if (products.length && startIdx !== -1 && endIdx !== -1) {
        html =
          html.slice(0, startIdx) +
          buildItemList(products) +
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
