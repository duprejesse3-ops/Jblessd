// Edge function: server-rendered, crawlable landing pages.
//
//   /product/:sku   — a full product page with unique title/meta, Product +
//                     BreadcrumbList + AggregateRating/Review JSON-LD, visible
//                     copy, related-product links, and an "open in store" CTA.
//   /tools/:niche   — a role landing page (Founders, Developers, …) listing the
//                     tools for that audience, each linking to its product page.
//
// The storefront itself is a single-page app, so without these Google/Bing and
// AI answer engines would only ever see one URL. These pages give every product
// and every audience its own indexable URL with real content, and they link to
// each other so crawlers can walk the whole catalog: home → /tools/:niche →
// /product/:sku → related products.
//
// Everything is generated from the live catalog (and live reviews), so it never
// drifts from what's actually for sale.

import type { Context, Config } from '@netlify/edge-functions'

const SITE = 'https://jblessd.com'
const STORE = 'MULTI-VICE AI'
const FETCH_TIMEOUT_MS = 1500
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

const CATEGORY_LABEL: Record<string, string> = {
  prompts: 'Prompt Packs',
  automations: 'Automation Blueprints',
  templates: 'Doc Templates',
  agents: 'Agent Configs',
}
const NICHE_LABEL: Record<string, string> = {
  founders: 'Founders & Ops',
  sales: 'Sales & CS',
  marketers: 'Marketers',
  developers: 'Developers',
  writers: 'Writers',
  students: 'Students & Researchers',
  architects: 'Architects',
  engineers: 'Engineers',
}
const NICHE_INTRO: Record<string, string> = {
  founders: 'Tools that give a small team back its time — planning, meetings, follow-ups, and the busywork around them.',
  sales: 'Close the loop faster: triage inbound, keep relationships warm, and turn conversations into next steps.',
  marketers: 'From first draft to on-brand output — copy, calendars, and creative that ship without the fiddly parts.',
  developers: 'Agents and automations that fit your workflow: PRs, standups, knowledge bases, and grounded answers.',
  writers: 'Keep your voice, lose the blank page — prompts and templates tuned for tone, structure, and speed.',
  students: 'Research and study, organized — literature scans, source comparison, and a weekly operating rhythm.',
  architects: 'Own the shape of the system — decision records, design reviews, and trade-off analysis that outlast the whiteboard.',
  engineers: 'Ship and operate with confidence — infrastructure, incidents, pipelines, and the runbooks that hold it all together.',
}

interface ApiProduct {
  sku: string
  name: string
  category: string
  niche: string
  format: string
  price: number
  blurb: string
  spec: string
  catLabel?: string
  nicheLabel?: string
}

interface Aggregate {
  count: number
  average: number
}
interface Review {
  author: string
  rating: number
  body: string
  createdAt: string | null
}

const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c])
}

// JSON embedded in HTML must not contain a literal "<".
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function money(n: number): string {
  return `$${Number(n).toFixed(2)}`
}

async function getJson<T>(url: URL): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function catLabel(p: ApiProduct): string {
  return p.catLabel ?? CATEGORY_LABEL[p.category] ?? p.category
}
function nicheLabel(p: ApiProduct): string {
  return p.nicheLabel ?? NICHE_LABEL[p.niche] ?? p.niche
}

// ---- shared page chrome (brand-consistent, self-contained) ----
function page(opts: {
  title: string
  description: string
  canonical: string
  jsonld: unknown[]
  body: string
}): Response {
  const head =
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="UTF-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0"/>` +
    `<meta name="theme-color" content="#000803"/>` +
    `<title>${esc(opts.title)}</title>` +
    `<meta name="description" content="${esc(opts.description)}"/>` +
    `<link rel="canonical" href="${esc(opts.canonical)}"/>` +
    `<meta name="robots" content="index, follow, max-image-preview:large"/>` +
    `<meta property="og:type" content="website"/>` +
    `<meta property="og:site_name" content="${STORE}"/>` +
    `<meta property="og:title" content="${esc(opts.title)}"/>` +
    `<meta property="og:description" content="${esc(opts.description)}"/>` +
    `<meta property="og:url" content="${esc(opts.canonical)}"/>` +
    `<meta property="og:image" content="${SITE}/og-image.png"/>` +
    `<meta name="twitter:card" content="summary_large_image"/>` +
    `<meta name="twitter:image" content="${SITE}/og-image.png"/>` +
    `<link rel="icon" type="image/svg+xml" href="/icons/logo.svg"/>` +
    opts.jsonld.map((j) => `<script type="application/ld+json">${safeJson(j)}</script>`).join('') +
    `<style>` +
    `:root{--ink:#000803;--panel:#07110A;--line:#124A20;--line-soft:#0A2A12;--paper:#C9FFD4;--muted:#4BD66A;--muted-2:#2C7A41;--brass:#00FF41;}` +
    `*{box-sizing:border-box}` +
    `body{margin:0;background:var(--ink);color:var(--paper);font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}` +
    `a{color:var(--brass);text-decoration:none}a:hover{text-decoration:underline}` +
    `.wrap{max-width:820px;margin:0 auto;padding:32px 22px 72px}` +
    `header a.brand{font-family:'Fraunces',Georgia,serif;font-size:20px;color:var(--paper);letter-spacing:-.01em}` +
    `nav.crumbs{font-size:12.5px;color:var(--muted-2);margin:26px 0 18px;font-family:'JetBrains Mono',monospace}` +
    `nav.crumbs a{color:var(--muted)}` +
    `h1{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:clamp(28px,5vw,40px);line-height:1.12;letter-spacing:-.02em;margin:.2em 0}` +
    `.sku{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.14em;color:var(--muted-2);text-transform:uppercase}` +
    `.tag{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink);background:var(--brass);padding:3px 9px;border-radius:2px}` +
    `.lede{font-size:17px;color:var(--paper);margin:18px 0}` +
    `.specs{border:1px solid var(--line);border-radius:4px;padding:6px 18px;margin:22px 0}` +
    `.specs .row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px dashed var(--line-soft);font-size:14px}` +
    `.specs .row:last-child{border-bottom:none}.specs .row span:first-child{color:var(--muted-2);font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase}` +
    `.buy{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:24px 0}` +
    `.price{font-family:'JetBrains Mono',monospace;font-size:30px;color:var(--paper)}` +
    `.btn{display:inline-flex;align-items:center;gap:8px;background:var(--brass);color:var(--ink);font-weight:600;font-size:14px;padding:12px 20px;border-radius:3px;border:none;cursor:pointer}` +
    `.btn.ghost{background:transparent;color:var(--brass);border:1px solid var(--line)}` +
    `h2{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:22px;margin:40px 0 14px}` +
    `.stars{color:var(--brass);letter-spacing:2px;font-size:17px}` +
    `.rev{border-top:1px solid var(--line-soft);padding:14px 0}` +
    `.rev .who{font-size:13px;color:var(--muted);font-weight:600}` +
    `.rev .txt{font-size:14.5px;color:var(--paper);margin:6px 0 0}` +
    `.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:8px}` +
    `.pcard{border:1px solid var(--line);border-radius:4px;padding:16px;display:block}` +
    `.pcard:hover{border-color:var(--brass);text-decoration:none}` +
    `.pcard .n{color:var(--paper);font-weight:600;font-size:15px}` +
    `.pcard .b{color:var(--muted);font-size:13px;margin:6px 0 10px}` +
    `.pcard .p{font-family:'JetBrains Mono',monospace;color:var(--brass);font-size:14px}` +
    `.roles{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}` +
    `.roles a{font-size:13px;border:1px solid var(--line);border-radius:2px;padding:6px 12px;color:var(--muted)}` +
    `footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line-soft);font-size:13px;color:var(--muted-2)}` +
    `</style></head><body><div class="wrap">` +
    `<header><a class="brand" href="/">${STORE}</a></header>`
  const foot =
    `<footer>${STORE} — ready-to-use AI productivity tools. ` +
    `<a href="/">Browse the full catalog</a> · <a href="/refund-policy/">Refund policy</a></footer>` +
    `</div></body></html>`

  return new Response(head + opts.body + foot, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}

function notFound(): Response {
  return page({
    title: `Not found | ${STORE}`,
    description: 'This page could not be found.',
    canonical: `${SITE}/`,
    jsonld: [],
    body: `<nav class="crumbs"><a href="/">Home</a></nav><h1>Not here</h1><p class="lede">That page doesn't exist (or the product was delisted). <a href="/">Head back to the catalog →</a></p>`,
  })
}

function stars(avg: number): string {
  const full = Math.round(avg)
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full)
}

// ---- /product/:sku ----
function renderProduct(p: ApiProduct, all: ApiProduct[], agg: Aggregate | null, reviews: Review[]): Response {
  const url = `${SITE}/product/${encodeURIComponent(p.sku)}`
  const cat = catLabel(p)
  const nl = nicheLabel(p)

  const productLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    category: cat,
    description: p.blurb,
    brand: { '@type': 'Brand', name: STORE },
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
  if (agg && agg.count > 0) {
    productLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: agg.average,
      reviewCount: agg.count,
      bestRating: 5,
      worstRating: 1,
    }
    if (reviews.length) {
      productLd.review = reviews.slice(0, 5).map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        reviewBody: r.body,
        ...(r.createdAt ? { datePublished: r.createdAt.slice(0, 10) } : {}),
      }))
    }
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: `Tools for ${nl}`, item: `${SITE}/tools/${p.niche}` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url },
    ],
  }

  const related = all
    .filter((x) => x.sku !== p.sku && (x.niche === p.niche || x.category === p.category))
    .slice(0, 4)

  const reviewsHtml =
    agg && agg.count > 0
      ? `<h2>Reviews</h2>` +
        `<p><span class="stars">${stars(agg.average)}</span> &nbsp;${agg.average} out of 5 · ${agg.count} review${agg.count === 1 ? '' : 's'}</p>` +
        reviews
          .slice(0, 8)
          .map(
            (r) =>
              `<div class="rev"><div class="who">${esc(r.author)} · <span class="stars">${stars(r.rating)}</span></div>${r.body ? `<p class="txt">${esc(r.body)}</p>` : ''}</div>`,
          )
          .join('')
      : `<h2>Reviews</h2><p style="color:var(--muted)">No reviews yet — be the first to review this tool inside the store.</p>`

  const relatedHtml = related.length
    ? `<h2>Related tools</h2><div class="grid">` +
      related
        .map(
          (r) =>
            `<a class="pcard" href="/product/${encodeURIComponent(r.sku)}"><div class="n">${esc(r.name)}</div><div class="b">${esc(r.blurb)}</div><div class="p">${money(r.price)}</div></a>`,
        )
        .join('') +
      `</div>`
    : ''

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/tools/${esc(p.niche)}">Tools for ${esc(nl)}</a> / ${esc(p.name)}</nav>` +
    `<span class="tag">${esc(cat)}</span> <span class="sku">${esc(p.sku)}</span>` +
    `<h1>${esc(p.name)}</h1>` +
    `<p class="lede">${esc(p.blurb)}</p>` +
    `<div class="specs">` +
    `<div class="row"><span>Built for</span><span>${esc(nl)}</span></div>` +
    `<div class="row"><span>Category</span><span>${esc(cat)}</span></div>` +
    `<div class="row"><span>Format</span><span>${esc(p.format)}</span></div>` +
    `<div class="row"><span>Spec</span><span>${esc(p.spec)}</span></div>` +
    `</div>` +
    `<div class="buy"><span class="price">${money(p.price)}</span>` +
    `<a class="btn" href="/?product=${encodeURIComponent(p.sku)}">Add to cart in store →</a></div>` +
    `<p style="font-size:13px;color:var(--muted)">Digital delivery is immediate. Sales are final after access is provided, subject to the <a href="/refund-policy/">refund policy</a>.</p>` +
    reviewsHtml +
    relatedHtml
  return page({
    title: `${p.name} — ${cat} | ${STORE}`,
    description: p.blurb,
    canonical: url,
    jsonld: [productLd, breadcrumb],
    body,
  })
}

// ---- /tools/:niche ----
function renderNiche(niche: string, all: ApiProduct[], aggs: Record<string, Aggregate>): Response {
  const nl = NICHE_LABEL[niche]
  const url = `${SITE}/tools/${niche}`
  const items = all.filter((p) => p.niche === niche)
  if (!items.length) return notFound()

  const intro = NICHE_INTRO[niche] ?? `Ready-to-use AI tools for ${nl}.`

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `AI tools for ${nl}`,
    url,
    description: intro,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/product/${encodeURIComponent(p.sku)}`,
        name: p.name,
      })),
    },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: `Tools for ${nl}`, item: url },
    ],
  }

  const cards = items
    .map((p) => {
      const agg = aggs[p.sku]
      const rating = agg && agg.count > 0 ? `<div style="margin-top:6px" class="stars">${stars(agg.average)} <span style="color:var(--muted-2);font-size:12px">(${agg.count})</span></div>` : ''
      return (
        `<a class="pcard" href="/product/${encodeURIComponent(p.sku)}">` +
        `<div class="n">${esc(p.name)}</div>` +
        `<div class="b">${esc(p.blurb)}</div>` +
        `<div class="p">${money(p.price)} · ${esc(catLabel(p))}</div>${rating}</a>`
      )
    })
    .join('')

  const otherRoles = Object.keys(NICHE_LABEL)
    .filter((n) => n !== niche)
    .map((n) => `<a href="/tools/${n}">${esc(NICHE_LABEL[n])}</a>`)
    .join('')

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Tools for ${esc(nl)}</nav>` +
    `<h1>AI tools for ${esc(nl)}</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    `<div class="grid">${cards}</div>` +
    `<h2>Browse by role</h2><div class="roles">${otherRoles}</div>`

  return page({
    title: `AI tools for ${nl} — prompt packs, automations & agents | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [itemListLd, breadcrumb],
    body,
  })
}

export default async (req: Request, _context: Context) => {
  const { pathname } = new URL(req.url)
  const parts = pathname.split('/').filter(Boolean) // ["product","SKU"] or ["tools","niche"]

  const data = await getJson<{ products?: ApiProduct[] }>(new URL('/api/products', req.url))
  const products = data?.products ?? []
  if (!products.length) return notFound()

  if (parts[0] === 'tools') {
    const niche = decodeURIComponent(parts[1] ?? '').toLowerCase()
    if (!NICHE_LABEL[niche]) return notFound()
    const aggData = await getJson<{ aggregates?: Record<string, Aggregate> }>(new URL('/api/reviews', req.url))
    return renderNiche(niche, products, aggData?.aggregates ?? {})
  }

  if (parts[0] === 'product') {
    const sku = decodeURIComponent(parts[1] ?? '')
    const product = products.find((p) => p.sku === sku)
    if (!product) return notFound()
    const rev = await getJson<{ reviews?: Review[]; aggregate?: Aggregate }>(
      new URL(`/api/reviews?sku=${encodeURIComponent(sku)}`, req.url),
    )
    return renderProduct(product, products, rev?.aggregate ?? null, rev?.reviews ?? [])
  }

  return notFound()
}

export const config: Config = {
  path: ['/product/*', '/tools/*'],
}
