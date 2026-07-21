// Edge function: server-rendered, crawlable landing pages.
//
//   /product/:sku   — a full product page with unique title/meta, Product +
//                     BreadcrumbList + AggregateRating/Review JSON-LD, visible
//                     copy, related-product links, and an "open in store" CTA.
//   /tools/:niche   — a role landing page (Founders, Developers, …) listing the
//                     tools for that audience, each linking to its product page.
//   /proof/:id      — a shared "Live Proof" run: a real demonstration of a
//                     product working, saved by a shopper, with a CTA into the
//                     store. Turns the store's signature feature into shareable,
//                     indexable content.
//   /proof          — an index of recent shared proofs so crawlers can find them.
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
const STORE = 'MULTINICHE AI'
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

// Outcome-based landing pages (/use-cases/:slug). These sit orthogonal to the
// role pages: instead of "who are you", they answer "what do you want to get
// done". Each matches products by keyword against name/blurb/spec so it tracks
// the live catalog without hard-coding SKUs. Slugs are kept in sync with the
// sitemap function's USE_CASE_SLUGS.
interface UseCase {
  slug: string
  title: string
  h1: string
  intro: string
  keywords: string[]
}
const USE_CASES: UseCase[] = [
  {
    slug: 'draft-investor-updates',
    title: 'Draft investor updates with AI',
    h1: 'Draft investor updates with AI',
    intro: 'Keep investors warm without losing a morning to it — metrics, narrative, and a clear ask, drafted for you.',
    keywords: ['investor', 'update', 'okr', 'metric', 'planning', 'spec'],
  },
  {
    slug: 'triage-support-tickets',
    title: 'Triage support tickets with AI',
    h1: 'Triage and answer support tickets with AI',
    intro: 'Read every inbound ticket, draft the reply, route the hard ones to a human, and catch churn before it happens.',
    keywords: ['support', 'ticket', 'triage', 'churn', 'onboarding', 'crm'],
  },
  {
    slug: 'hit-inbox-zero',
    title: 'Hit inbox zero with AI',
    h1: 'Get to inbox zero with AI',
    intro: 'Auto-sort, draft replies, handle the back-and-forth, and flag only what actually needs you.',
    keywords: ['inbox', 'email', 'negotiat', 'crm'],
  },
  {
    slug: 'ship-content-faster',
    title: 'Ship content faster with AI',
    h1: 'Ship on-brand content faster with AI',
    intro: 'From hooks and headlines to a full calendar and on-brand visuals — draft, tune, and queue without the blank page.',
    keywords: ['content', 'headline', 'hook', 'seo', 'image', 'writing', 'style', 'landing'],
  },
  {
    slug: 'run-better-standups',
    title: 'Run better standups and meetings with AI',
    h1: 'Run better standups and meetings with AI',
    intro: 'Turn transcripts into decisions, collect async updates, and ship a one-line digest — no synchronous standup required.',
    keywords: ['standup', 'meeting', 'notes', 'release', 'digest', 'postmortem'],
  },
  {
    slug: 'research-with-citations',
    title: 'Research with citations using AI',
    h1: 'Research anything with citations, not guesses',
    intro: 'Literature scans, source comparison, and grounded answers that cite where they came from.',
    keywords: ['research', 'citation', 'literature', 'retrieval', 'knowledge', 'source', 'swarm'],
  },
]

interface CampaignAssets {
  tagline?: string
  tweets?: string[]
  linkedin?: string
  instagram?: string
  email?: { subject?: string; body?: string }
  seo?: { metaTitle?: string; metaDescription?: string }
  adHeadlines?: string[]
}
interface Campaign {
  id: number
  sku: string
  productName: string
  goal: string
  source: string
  assets: CampaignAssets
  createdAt: string | null
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

interface Proof {
  id: string
  sku: string
  productName: string
  scenario: string
  output: string
  createdAt: string | null
  url: string
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
  status?: number
  robots?: string
  ogType?: string
  extraMeta?: string
}): Response {
  const head =
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="UTF-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0"/>` +
    `<meta name="theme-color" content="#000803"/>` +
    `<title>${esc(opts.title)}</title>` +
    `<meta name="description" content="${esc(opts.description)}"/>` +
    `<link rel="canonical" href="${esc(opts.canonical)}"/>` +
    `<meta name="robots" content="${esc(opts.robots ?? 'index, follow, max-image-preview:large')}"/>` +
    `<meta property="og:type" content="${esc(opts.ogType ?? 'website')}"/>` +
    `<meta property="og:site_name" content="${STORE}"/>` +
    `<meta property="og:title" content="${esc(opts.title)}"/>` +
    `<meta property="og:description" content="${esc(opts.description)}"/>` +
    `<meta property="og:url" content="${esc(opts.canonical)}"/>` +
    `<meta property="og:image" content="${SITE}/multiniche-ai-og.png"/>` +
    `<meta name="twitter:card" content="summary_large_image"/>` +
    `<meta name="twitter:image" content="${SITE}/multiniche-ai-og.png"/>` +
    (opts.extraMeta ?? '') +
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
    `.proof{border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:22px 0;background:#040c07}` +
    `.proof-bar{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;color:var(--muted-2);padding:9px 14px;border-bottom:1px solid var(--line-soft);background:#07110A}` +
    `.proof-out{font-family:'JetBrains Mono',monospace;font-size:13.5px;line-height:1.7;color:var(--paper);padding:16px 18px;white-space:normal;word-break:break-word}` +
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
    `<a href="/">Catalog</a> · <a href="/use-cases">Use cases</a> · <a href="/proof">Live proofs</a> · <a href="/updates">Updates</a> · <a href="/refund-policy/">Refund policy</a></footer>` +
    `</div></body></html>`

  return new Response(head + opts.body + foot, {
    status: opts.status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}

// A real HTTP 404 (not a soft 404). Delisted products and unknown slugs must
// return a 404 status with a noindex directive so Google drops the URL and
// spends its crawl budget on live pages instead of indexing a "Not here" stub.
function notFound(): Response {
  return page({
    title: `Not found | ${STORE}`,
    description: 'This page could not be found.',
    canonical: `${SITE}/`,
    jsonld: [],
    status: 404,
    robots: 'noindex, follow',
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
    '@id': `${url}#product`,
    name: p.name,
    sku: p.sku,
    category: cat,
    description: p.blurb,
    brand: { '@type': 'Brand', name: STORE },
    image: `${SITE}/multiniche-ai-og.png`,
    url,
    mainEntityOfPage: url,
    audience: { '@type': 'Audience', audienceType: nl },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Built for', value: nl },
      { '@type': 'PropertyValue', name: 'Format', value: p.format },
      ...(p.spec && p.spec !== '—' ? [{ '@type': 'PropertyValue', name: 'Spec', value: p.spec }] : []),
    ],
    offers: {
      '@type': 'Offer',
      price: Number(p.price).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
      priceValidUntil: '2027-12-31',
      validFrom: OFFER_VALID_FROM,
      seller: { '@type': 'Organization', name: STORE, url: `${SITE}/` },
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
    ogType: 'product',
    extraMeta:
      `<meta property="product:price:amount" content="${Number(p.price).toFixed(2)}"/>` +
      `<meta property="product:price:currency" content="USD"/>` +
      `<meta property="product:availability" content="in stock"/>` +
      `<meta property="og:price:amount" content="${Number(p.price).toFixed(2)}"/>` +
      `<meta property="og:price:currency" content="USD"/>`,
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

// ---- /proof/:id ----
function renderProof(p: Proof): Response {
  const url = `${SITE}/proof/${p.id}`
  const productUrl = `${SITE}/product/${encodeURIComponent(p.sku)}`
  const outputHtml = esc(p.output).replace(/\n/g, '<br/>')
  const dateStr = p.createdAt ? p.createdAt.slice(0, 10) : ''

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Live proof — ${p.productName}`,
    url,
    description: `A real, unedited demonstration of ${p.productName} from ${STORE}.`,
    ...(p.createdAt ? { datePublished: p.createdAt } : {}),
    about: { '@type': 'Product', name: p.productName, sku: p.sku, url: productUrl },
  }

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/proof">Live proofs</a> / ${esc(p.productName)}</nav>` +
    `<span class="tag">Live proof</span>` +
    `<h1>Watch ${esc(p.productName)} actually work</h1>` +
    `<p class="lede">This is a real, unedited run of <a href="${esc(productUrl)}">${esc(p.productName)}</a> — no mockups, no cherry-picking. It's the store's whole promise: see the tool do the job before you pay for it.</p>` +
    (p.scenario
      ? `<div class="specs"><div class="row"><span>Run on</span><span>${esc(p.scenario)}</span></div></div>`
      : '') +
    `<div class="proof"><div class="proof-bar">demo · ${esc(p.productName)}${dateStr ? ` · ${esc(dateStr)}` : ''}</div><div class="proof-out">${outputHtml}</div></div>` +
    `<div class="buy"><a class="btn" href="/?product=${encodeURIComponent(p.sku)}">Get ${esc(p.productName)} →</a>` +
    `<a class="btn ghost" href="/">Run your own live proof</a></div>` +
    `<p style="font-size:13px;color:var(--muted)">Every tool in the catalog can be run live like this on your own task, free, before you buy.</p>`

  return page({
    title: `Live proof: ${p.productName} in action | ${STORE}`,
    description: `Watch ${p.productName} actually work — a real, unedited demonstration from ${STORE}. See the tool do the job before you buy.`,
    canonical: url,
    jsonld: [jsonld],
    body,
  })
}

// ---- /proof (index of recent shared proofs) ----
function renderProofIndex(proofs: Proof[]): Response {
  const url = `${SITE}/proof`
  const intro =
    'Every tool here can be run live on a real task before you buy. These are proofs shoppers saved and shared — real, unedited runs of tools doing the actual job.'

  const cards = proofs.length
    ? proofs
        .map((p) => {
          const snippet = p.output.replace(/\s+/g, ' ').slice(0, 150)
          return (
            `<a class="pcard" href="/proof/${encodeURIComponent(p.id)}">` +
            `<div class="n">${esc(p.productName)}</div>` +
            `<div class="b">${esc(snippet)}…</div>` +
            `<div class="p">See the full run →</div></a>`
          )
        })
        .join('')
    : ''

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Live proofs</nav>` +
    `<h1>Live proofs</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    (cards
      ? `<div class="grid">${cards}</div>`
      : `<p style="color:var(--muted)">No shared proofs yet. Open any product in the store, run its live demo, and hit “Share this proof” to publish one here.</p>`) +
    `<div class="buy"><a class="btn" href="/">Run a live proof in the store →</a></div>`

  return page({
    title: `Live proofs — watch AI tools actually work | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Live proofs',
        url,
        description: intro,
      },
    ],
    body,
  })
}

// ---- /use-cases/:slug and /use-cases ----
function matchUseCase(uc: UseCase, all: ApiProduct[]): ApiProduct[] {
  // Word-boundary match (not naive substring) so short tokens like "rag" or
  // "seo" can't match inside unrelated words. Keywords may be multi-word.
  const patterns = uc.keywords.map((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'))
  return all.filter((p) => {
    const hay = `${p.name} ${p.blurb} ${p.spec} ${p.format}`
    return patterns.some((re) => re.test(hay))
  })
}

function useCaseCards(items: ApiProduct[], aggs: Record<string, Aggregate>): string {
  return items
    .map((p) => {
      const agg = aggs[p.sku]
      const rating =
        agg && agg.count > 0
          ? `<div style="margin-top:6px" class="stars">${stars(agg.average)} <span style="color:var(--muted-2);font-size:12px">(${agg.count})</span></div>`
          : ''
      return (
        `<a class="pcard" href="/product/${encodeURIComponent(p.sku)}">` +
        `<div class="n">${esc(p.name)}</div><div class="b">${esc(p.blurb)}</div>` +
        `<div class="p">${money(p.price)} · ${esc(catLabel(p))}</div>${rating}</a>`
      )
    })
    .join('')
}

function renderUseCase(uc: UseCase, all: ApiProduct[], aggs: Record<string, Aggregate>): Response {
  const url = `${SITE}/use-cases/${uc.slug}`
  const items = matchUseCase(uc, all).slice(0, 12)
  if (!items.length) return notFound()

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: uc.title,
    url,
    description: uc.intro,
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
      { '@type': 'ListItem', position: 2, name: 'Use cases', item: `${SITE}/use-cases` },
      { '@type': 'ListItem', position: 3, name: uc.title, item: url },
    ],
  }

  const others = USE_CASES.filter((u) => u.slug !== uc.slug)
    .map((u) => `<a href="/use-cases/${u.slug}">${esc(u.title)}</a>`)
    .join('')

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/use-cases">Use cases</a> / ${esc(uc.title)}</nav>` +
    `<span class="tag">Use case</span>` +
    `<h1>${esc(uc.h1)}</h1>` +
    `<p class="lede">${esc(uc.intro)} Every tool below can be run live on your own task before you buy.</p>` +
    `<div class="grid">${useCaseCards(items, aggs)}</div>` +
    `<h2>Other things you can get done</h2><div class="roles">${others}</div>`

  return page({
    title: `${uc.title} — ${STORE}`,
    description: uc.intro,
    canonical: url,
    jsonld: [itemListLd, breadcrumb],
    body,
  })
}

function renderUseCaseIndex(): Response {
  const url = `${SITE}/use-cases`
  const intro = 'Pick the outcome you want. Each page lists the ready-to-run tools that get it done — and each one can be run live on your own task before you buy.'
  const cards = USE_CASES.map(
    (u) =>
      `<a class="pcard" href="/use-cases/${u.slug}"><div class="n">${esc(u.title)}</div><div class="b">${esc(u.intro)}</div><div class="p">See the tools →</div></a>`,
  ).join('')
  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Use cases</nav>` +
    `<h1>What do you want to get done?</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    `<div class="grid">${cards}</div>`
  return page({
    title: `AI tools by use case — what do you want to get done? | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Use cases', url, description: intro }],
    body,
  })
}

// ---- /updates and /updates/:id ----
// Public-facing feed built from the marketing agent's generated campaigns, so
// the copy it already produces (grounded in the real catalog) becomes fresh,
// indexable content instead of staying locked in the owner's dashboard.
function renderUpdate(c: Campaign): Response {
  const url = `${SITE}/updates/${c.id}`
  const a = c.assets ?? {}
  const productLink = c.sku && c.sku !== 'STORE' ? `${SITE}/product/${encodeURIComponent(c.sku)}` : `${SITE}/`
  const headline = a.tagline || `News from ${c.productName}`
  const bodyText = a.linkedin || a.email?.body || a.instagram || ''
  const paras = bodyText
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p class="lede">${esc(p)}</p>`)
    .join('')

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: headline.slice(0, 110),
    url,
    ...(c.createdAt ? { datePublished: c.createdAt } : {}),
    publisher: { '@type': 'Organization', name: STORE, url: SITE },
    about: { '@type': 'Product', name: c.productName, url: productLink },
  }

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/updates">Updates</a> / ${esc(c.productName)}</nav>` +
    `<span class="tag">Update</span>` +
    `<h1>${esc(headline)}</h1>` +
    (paras || `<p class="lede">${esc(c.productName)} — take a look.</p>`) +
    `<div class="buy"><a class="btn" href="${esc(productLink.replace(SITE, '') || '/')}">${c.sku && c.sku !== 'STORE' ? `See ${esc(c.productName)} →` : 'Browse the catalog →'}</a></div>`

  return page({
    title: `${(a.seo?.metaTitle || headline).slice(0, 60)} | ${STORE}`,
    description: (a.seo?.metaDescription || c.productName).slice(0, 155),
    canonical: url,
    jsonld: [jsonld],
    body,
  })
}

function renderUpdatesIndex(campaigns: Campaign[]): Response {
  const url = `${SITE}/updates`
  const intro = 'The latest from MULTINICHE AI — new tools, launches, and what we’re building.'
  const cards = campaigns.length
    ? campaigns
        .map((c) => {
          const a = c.assets ?? {}
          const line = a.tagline || a.seo?.metaDescription || c.productName
          return `<a class="pcard" href="/updates/${c.id}"><div class="n">${esc(c.productName)}</div><div class="b">${esc(line)}</div><div class="p">Read →</div></a>`
        })
        .join('')
    : ''
  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Updates</nav>` +
    `<h1>Updates</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    (cards
      ? `<div class="grid">${cards}</div>`
      : `<p style="color:var(--muted)">Nothing published yet — check back soon, or <a href="/">browse the catalog</a>.</p>`)
  return page({
    title: `Updates — new AI tools and launches | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Updates', url, description: intro }],
    body,
  })
}

// ---- /free-tool ----  "Watch AI do your task": describe a job, the concierge
// picks the right tool, and its live demo runs on your task — no signup. A
// genuinely useful top-of-funnel utility that routes into the matching product.
function renderFreeTool(): Response {
  const url = `${SITE}/free-tool`
  const intro = 'Describe something you need to get done. We’ll pick the right AI tool and run it on your task, live — free, no signup. Then you decide if it’s worth owning.'

  const script =
    `(function(){` +
    `var f=document.getElementById('ft-form'),i=document.getElementById('ft-input'),b=document.getElementById('ft-run');` +
    `var term=document.getElementById('ft-term'),out=document.getElementById('ft-out'),lab=document.getElementById('ft-lab'),cta=document.getElementById('ft-cta');` +
    `var esc=function(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});};` +
    `var busy=false,lastOut='',lastSku='',lastTask='';` +
    `function setOut(t){out.innerHTML=esc(t)+'<span class=\"ft-cursor\"></span>';out.scrollTop=out.scrollHeight;}` +
    `f.addEventListener('submit',function(e){e.preventDefault();run();});` +
    `async function run(){` +
    `var task=i.value.trim();if(task.length<3){return;}if(busy)return;busy=true;b.disabled=true;cta.hidden=true;` +
    `term.hidden=false;lab.textContent='matching · finding the right tool';out.innerHTML='<span class=\"ft-cursor\"></span>';` +
    `var sku='',name='',price=0;` +
    `try{` +
    `var cr=await fetch('/api/concierge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:task})});` +
    `var cd=await cr.json().catch(function(){return {};});` +
    `if(!cr.ok||!cd.recommendations||!cd.recommendations.length){throw new Error('no-match');}` +
    `var top=cd.recommendations[0];sku=top.sku;name=top.name;price=top.price;lastSku=sku;lastTask=task;` +
    `lab.textContent='demo · '+name;` +
    `var dr=await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku:sku,scenario:task})});` +
    `if(!dr.ok||!dr.body){throw new Error('demo');}` +
    `var reader=dr.body.getReader(),dec=new TextDecoder(),buf='',ans='',got=false;` +
    `while(true){var ch=await reader.read();if(ch.done)break;buf+=dec.decode(ch.value,{stream:true});var ls=buf.split('\\n');buf=ls.pop();` +
    `for(var k=0;k<ls.length;k++){var ln=ls[k].trim();if(!ln)continue;var ev;try{ev=JSON.parse(ln);}catch(_){continue;}` +
    `if(ev.type==='text'){got=true;ans+=ev.text;setOut(ans);}}}` +
    `if(!got)throw new Error('empty');lastOut=ans;out.innerHTML=esc(ans);lab.textContent='demo · complete';` +
    // Build the CTA hrefs from variables rather than inline string literals. The
    // discovery crawler extracts links with a regex over raw HTML; a literal
    // href="/product/'+sku pattern makes it capture a bare "/product/" (up to the
    // quote) and report a phantom 404. Interpolating a variable keeps a quote
    // immediately after href=" so nothing bogus is captured.
    `var storeHref='/?product='+encodeURIComponent(sku),detailHref='/product/'+encodeURIComponent(sku);` +
    `cta.innerHTML='<p>That was <b>'+esc(name)+'</b> ($'+parseFloat(price).toFixed(2)+') running on your task.</p>'+` +
    `'<a class=\"btn\" href=\"'+storeHref+'\">Get '+esc(name)+' →</a> '+` +
    `'<a class=\"btn ghost\" href=\"'+detailHref+'\">See details</a> '+` +
    `'<button class=\"btn ghost\" id=\"ft-share\" type=\"button\">Share this result</button><span id=\"ft-link\"></span>';cta.hidden=false;` +
    `var sb=document.getElementById('ft-share');if(sb){sb.addEventListener('click',shareProof);}` +
    `}catch(err){out.innerHTML='<span class=\"ft-hint\">The live engine is warming up (it activates after the first production deploy), or no close match was found. Try describing your task in a bit more detail.</span>';lab.textContent='demo · offline';}` +
    `finally{busy=false;b.disabled=false;}}` +
    `async function shareProof(){if(!lastSku||!lastOut)return;var sb=document.getElementById('ft-share');sb.disabled=true;sb.textContent='Publishing…';` +
    `try{var r=await fetch('/api/proof',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku:lastSku,scenario:lastTask,output:lastOut})});` +
    `var d=await r.json().catch(function(){return {};});if(!r.ok||!d.url)throw new Error('x');` +
    `document.getElementById('ft-link').innerHTML=' <a href=\"'+esc(d.url)+'\">'+esc(d.url)+'</a>';sb.remove();}` +
    `catch(e){sb.disabled=false;sb.textContent='Share this result';}}` +
    `})();`

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Watch AI do your task</nav>` +
    `<span class="tag">Free · no signup</span>` +
    `<h1>Watch AI do your task</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    `<form id="ft-form" style="margin:18px 0">` +
    `<textarea id="ft-input" rows="3" maxlength="600" placeholder="e.g. Turn my messy meeting notes into decisions, owners, and deadlines" ` +
    `style="width:100%;background:#040c07;color:var(--paper);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-family:inherit;font-size:15px;resize:vertical"></textarea>` +
    `<button class="btn" id="ft-run" type="submit" style="margin-top:10px">▶ Run it on my task</button></form>` +
    `<div class="proof" id="ft-term" hidden><div class="proof-bar" id="ft-lab">demo · idle</div><div class="proof-out" id="ft-out"></div></div>` +
    `<div id="ft-cta" class="buy" hidden></div>` +
    `<p style="font-size:13px;color:var(--muted)">Prefer to browse? <a href="/">See the full catalog</a> or explore <a href="/use-cases">tools by use case</a>.</p>` +
    `<style>.ft-cursor{display:inline-block;width:8px;height:14px;background:var(--brass);vertical-align:text-bottom;animation:ftb 1s step-end infinite}` +
    `@keyframes ftb{0%,100%{opacity:1}50%{opacity:0}}.ft-hint{color:var(--muted)}#ft-cta p{margin:0 0 10px;color:var(--paper)}#ft-link a{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--brass)}</style>` +
    `<script>${script}</script>`

  return page({
    title: `Watch AI do your task — free, no signup | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Watch AI do your task',
        url,
        applicationCategory: 'BusinessApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description: intro,
      },
    ],
    body,
  })
}

export default async (req: Request, _context: Context) => {
  const { pathname } = new URL(req.url)
  const parts = pathname.split('/').filter(Boolean) // ["product","SKU"] or ["tools","niche"]

  // ---- /free-tool ----  a no-signup "watch AI do your task" utility. Purely
  // client-driven (it calls /api/concierge then /api/demo), so it needs no
  // server data — render the shell and let the browser do the work.
  if (parts[0] === 'free-tool') {
    return renderFreeTool()
  }

  // ---- /proof (index) and /proof/:id ----  handled first: these don't need
  // the catalog, so a shared proof still renders even if /api/products is slow.
  if (parts[0] === 'proof') {
    if (parts[1]) {
      const id = decodeURIComponent(parts[1])
      const res = await getJson<{ proof?: Proof | null }>(new URL(`/api/proof?id=${encodeURIComponent(id)}`, req.url))
      if (!res?.proof) return notFound()
      return renderProof(res.proof)
    }
    const res = await getJson<{ proofs?: Proof[] }>(new URL('/api/proof', req.url))
    return renderProofIndex(res?.proofs ?? [])
  }

  // ---- /updates (index) and /updates/:id ----  also catalog-independent.
  if (parts[0] === 'updates') {
    const res = await getJson<{ campaigns?: Campaign[] }>(new URL('/api/marketing-agent', req.url))
    const campaigns = res?.campaigns ?? []
    if (parts[1]) {
      const id = Number(decodeURIComponent(parts[1]))
      const c = campaigns.find((x) => x.id === id)
      if (!c) return notFound()
      return renderUpdate(c)
    }
    return renderUpdatesIndex(campaigns)
  }

  const data = await getJson<{ products?: ApiProduct[] }>(new URL('/api/products', req.url))
  const products = data?.products ?? []
  if (!products.length) return notFound()

  // ---- /use-cases (index) and /use-cases/:slug ----
  if (parts[0] === 'use-cases') {
    if (!parts[1]) return renderUseCaseIndex()
    const uc = USE_CASES.find((u) => u.slug === decodeURIComponent(parts[1]).toLowerCase())
    if (!uc) return notFound()
    const aggData = await getJson<{ aggregates?: Record<string, Aggregate> }>(new URL('/api/reviews', req.url))
    return renderUseCase(uc, products, aggData?.aggregates ?? {})
  }

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
  path: ['/product/*', '/tools/*', '/proof', '/proof/*', '/use-cases', '/use-cases/*', '/updates', '/updates/*', '/free-tool'],
}
