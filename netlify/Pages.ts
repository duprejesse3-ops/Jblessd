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
  office: 'Office & Admin',
  finance: 'Finance & Investing',
  stores: 'Store & Site Owners',
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
  office: 'Get through the workday faster — email, meetings, expenses, and the recurring admin that eats an afternoon.',
  finance: 'Money decisions, done in the browser — valuation, rebalancing, cashflow, and the models investors expect, run live on your own numbers.',
  stores: 'Keep your own storefront healthy — monitoring, SEO, and link checks you run on your own infrastructure, owned outright instead of rented monthly.',
}
interface NicheFaqItem { q: string; a: string }

// Optional deeper SEO/documentation content for specific niches. Only niches
// with real workflows worth explaining get an entry — other niche pages stay
// lean with just the catalog grid.
const NICHE_DEEP_DIVE: Record<string, string> = {
  developers:
    `<p>Every tool here runs the way your team already works: no dashboards to learn, no new accounts — just a prompt, an automation, or an agent config that plugs into what you're already doing.</p>` +
    `<p><strong>PR &amp; code review</strong> — prompt packs and agent configs that read a diff and return the review a senior engineer would leave: what's risky, what's missing tests, what to rename before merge.</p>` +
    `<p><strong>Standups &amp; release notes</strong> — automation blueprints that turn a raw commit log or async check-in into a one-paragraph digest, so the meeting is optional instead of mandatory.</p>` +
    `<p><strong>Grounded Q&amp;A over your own docs</strong> — agent configs built for retrieval: point one at a knowledge base or a repo's docs folder and get answers that cite where they came from, not guesses.</p>` +
    `<p><strong>Incident &amp; postmortem write-ups</strong> — doc templates that turn a timeline of what happened into a clean, blameless postmortem in the format your team already uses.</p>`,
}

const NICHE_FAQ: Record<string, NicheFaqItem[]> = {
  developers: [
    {
      q: 'Do these tools require an API key or account setup?',
      a: 'No signup for the prompt packs and doc templates — download and use them in whatever model you already have access to. Agent Configs and Automation Blueprints include their own setup instructions where a key or webhook is needed.',
    },
    {
      q: 'Can I see a tool run before buying it?',
      a: 'Yes — every product page has a live proof: a real, unedited run of the tool on a sample task. You can also describe your own task on the free tool page and watch a tool run on it live, no signup required.',
    },
    {
      q: 'Are these one-time purchases or subscriptions?',
      a: 'One-time purchase per tool. You get the prompt pack, blueprint, template, or agent config outright — no recurring fee to keep using what you bought.',
    },
    {
      q: "What's the difference between a Prompt Pack and an Agent Config?",
      a: 'A Prompt Pack is a set of ready-to-paste prompts for a specific job. An Agent Config goes a step further: a configured agent that runs a workflow rather than answering one prompt at a time.',
    },
  ],
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

interface Guide {
  slug: string
  niche: string
  category: string
  title: string
  metaDescription: string
  bodyHtml: string
  productSkus: string[]
  generatedAt: string | null
  publishedAt: string | null
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

// Compose a <title> that ends with the store name exactly once.
//
// Most titles on this site are built from catalog fields and can just append
// "| STORE". The update pages cannot: their metaTitle comes from the marketing
// agent, which has usually already branded the line itself. Appending
// unconditionally produced
//   "MULTINICHE AI — the full toolkit | MULTINICHE AI | MULTINICHE AI"
// on /updates/:id. A brand repeated three times reads as keyword stuffing, and
// Google's response is to discard the title and write its own from the page —
// so the one field we fully control stops saying what we chose.
//
// Any trailing separator+brand is stripped as often as it appears, the lead is
// then capped so the meaningful part survives Google's ~600px truncation, and
// the suffix is re-added only when what remains does not already name the store.
function titleWithStore(lead: string, max = 60): string {
  const brand = STORE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tail = new RegExp(`\\s*[|\\u2014\\u2013-]\\s*${brand}\\s*$`, 'i')
  let t = lead.trim()
  while (tail.test(t)) t = t.replace(tail, '').trim()
  t = t.slice(0, max).trim()
  return t.toLowerCase().includes(STORE.toLowerCase()) ? t : `${t} | ${STORE}`
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

// Same fetch, but it reports *why* it came back empty.
//
// getJson() collapses "the API answered, and there is no such record" and "the API
// never answered" into the same null. For the optional fetches — reviews, rating
// aggregates — that is the right trade: an outage there should still render the
// page, just without stars. For a URL whose existence is the question being asked
// it is exactly wrong, because the caller has to pick a status code and null does
// not tell it which one is true. Picking 404 tells Google the page is gone and
// invites it to delist a URL that was merely slow that second; picking 503 tells it
// to come back later, which is the honest answer to a timeout.
//
// The distinction is safe to draw here because /api/marketing-agent and /api/proof
// both answer a genuinely missing record with HTTP 200 and an empty payload, so a
// non-OK response or a thrown request is never "absent" — it is only ever "we could
// not ask". One retry, for the same reason getCatalog() takes one: the first
// attempt doubles as the warm-up for a cold serverless container plus its Postgres
// connection, which is what overruns a 1500 ms budget in the first place.
type Fetched<T> = { ok: true; data: T } | { ok: false }

async function getJsonOrFail<T>(url: URL): Promise<Fetched<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await getJson<T>(url)
    if (data !== null) return { ok: true, data }
  }
  return { ok: false }
}

// The catalog is the one fetch a product/niche/use-case page cannot render without,
// and the first request to it also pays for a serverless cold start plus a Postgres
// connection — which regularly overruns FETCH_TIMEOUT_MS. A single attempt therefore
// turned a warm-up into "product not found": a live URL answered 404, which is how a
// perfectly tagged page ends up reported as untagged, and how Google is invited to
// delist it. The first attempt doubles as the warm-up, so one retry is enough.
async function getCatalog(req: Request): Promise<ApiProduct[] | null> {
  const url = new URL('/api/products', req.url)
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await getJson<{ products?: ApiProduct[] }>(url)
    if (data?.products?.length) return data.products
  }
  return null
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
  image?: string
}): Response {
  const head =
    `<!DOCTYPE html><html lang="en"><head>` +
    `<script src="/privacy-consent.js"></script>` +
    // Google tag (gtag.js) — same Google Ads tag the static storefront (index.html)
    // loads, so these edge-rendered pages report as "tagged" in Google Tag Assistant
    // and share the site-wide measurement/conversion tracking instead of being blind spots.
    // allow_enhanced_conversions matches index.html: it lets the tag send hashed
    // user_data, which is what Google Ads enhanced ("advanced") conversions need.
    `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-17866165108"></script>` +
    `<script>window.GOOGLE_ADS_TAG_ID='AW-17866165108';window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-17866165108',{allow_enhanced_conversions:true});</script>` +
    // Google Tag Manager container — also mirrored from index.html so Tag Assistant
    // finds GTM-M746RK4R on every page of the site, not just the homepage. The `n`
    // lines copy the per-request nonce from csp.ts onto the gtm.js element created
    // here, so GTM can propagate it to the scripts it injects.
    `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});` +
    `var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;` +
    `j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;` +
    `var n=d.querySelector('[nonce]');n&&j.setAttribute('nonce',n.nonce||n.getAttribute('nonce'));` +
    `f.parentNode.insertBefore(j,f);` +
    `})(window,document,'script','dataLayer','GTM-M746RK4R');</script>` +
    `<script src="/marketing-measurement.js"></script>` +
    // Taboola pixel — mirrored from index.html for the same reason as the Google
    // tags above: without it these edge-rendered pages are blind spots that a
    // Taboola campaign can send traffic to but never build an audience from.
    // Loaded last of the three so the consent script and the measurement hub it
    // depends on are already defined.
    `<script src="/taboola-pixel.js"></script>` +
    `<meta charset="UTF-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0"/>` +
    `<meta http-equiv="content-language" content="en-US"/>` +
    `<meta name="theme-color" content="#0A0E16"/>` +
    `<title>${esc(opts.title)}</title>` +
    `<meta name="description" content="${esc(opts.description)}"/>` +
    `<link rel="canonical" href="${esc(opts.canonical)}"/>` +
    `<meta name="robots" content="${esc(opts.robots ?? 'index, follow, max-image-preview:large')}"/>` +
    `<meta property="og:type" content="${esc(opts.ogType ?? 'website')}"/>` +
    `<meta property="og:site_name" content="${STORE}"/>` +
    `<meta property="og:title" content="${esc(opts.title)}"/>` +
    `<meta property="og:description" content="${esc(opts.description)}"/>` +
    `<meta property="og:url" content="${esc(opts.canonical)}"/>` +
    `<meta property="og:image" content="${esc(opts.image ?? `${SITE}/multiniche-ai-og.png`)}"/>` +
    `<meta name="twitter:card" content="summary_large_image"/>` +
    `<meta name="twitter:image" content="${esc(opts.image ?? `${SITE}/multiniche-ai-og.png`)}"/>` +
    (opts.extraMeta ?? '') +
    `<link rel="icon" type="image/svg+xml" href="/icons/logo.svg"/>` +
    opts.jsonld.map((j) => `<script type="application/ld+json">${safeJson(j)}</script>`).join('') +
    `<style>` +
    `:root{--ink:#0A0E16;--panel:#121826;--line:#232B3D;--line-soft:#161C29;--paper:#EEF1F7;--muted:#9AA4BC;--muted-2:#5C6580;--brass:#FFB020;--danger:#FF2A2A;}` +
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
    `.badge-new{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass);background:transparent;border:1px solid var(--brass);padding:2px 8px;border-radius:2px}` +
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
    `.proof{border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:22px 0;background:#0D111C}` +
    `.proof-bar{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;color:var(--muted-2);padding:9px 14px;border-bottom:1px solid var(--line-soft);background:#121826}` +
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
    `</style></head><body>` +
    // Google Tag Manager (noscript) — the second half of GTM's install snippet,
    // mirrored from index.html. It was missing here, so every edge-rendered page
    // shipped only the JS half of the container. Tag detectors that fetch a page
    // without running its scripts (Google's tag coverage crawler among them) look
    // for this iframe, which is why /product/* and /updates/* reported "Not tagged"
    // while the static homepage reported "Tagged". frame-src in the CSP already
    // allows googletagmanager.com, so it loads under the nonce policy unchanged.
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M746RK4R"` +
    ` height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` +
    `<div class="wrap">` +
    `<header><a class="brand" href="/">${STORE}</a></header>`
  const foot =
    `<footer>${STORE} — ready-to-use AI productivity tools. ` +
    `<a href="/">Catalog</a> · <a href="/agent">Agent studio</a> · <a href="/use-cases">Use cases</a> · <a href="/proof">Live proofs</a> · <a href="/updates">Updates</a> · <a href="/guides">Guides</a> · <a href="/privacy-policy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/refund-policy/">Refund policy</a></footer>` +
    `</div><script>(function(){var q=new URLSearchParams(location.search),keys=['gclid','gbraid','wbraid'],clickId='',clickSource='';for(var i=0;i<keys.length;i++){if(q.get(keys[i])){clickId=q.get(keys[i]).slice(0,200);clickSource=keys[i];break;}}var utmKeys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content'],hasUtm=utmKeys.some(function(k){return q.get(k);});if(clickId){try{localStorage.setItem('osc:adclick',JSON.stringify({id:clickId,source:clickSource,ts:Date.now()}));}catch(e){}}if(hasUtm){try{var attrib={ts:Date.now()};utmKeys.forEach(function(k){if(q.get(k))attrib[k]=q.get(k).slice(0,200);});localStorage.setItem('osc:attrib',JSON.stringify(attrib));}catch(e){}}if(!clickId&&!hasUtm)return;var body=JSON.stringify({clickId:clickId||undefined,clickSource:clickSource||undefined,utmSource:q.get('utm_source')||undefined,utmMedium:q.get('utm_medium')||undefined,utmCampaign:q.get('utm_campaign')||undefined,utmTerm:q.get('utm_term')||undefined,utmContent:q.get('utm_content')||undefined,landingPath:location.pathname.slice(0,512),referrerHost:(function(){try{return document.referrer?new URL(document.referrer).hostname:undefined}catch(e){return undefined}})()});if(navigator.sendBeacon)navigator.sendBeacon('/api/track-landing',new Blob([body],{type:'application/json'}));else fetch('/api/track-landing',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true}).catch(function(){});})();</script></body></html>`

  return new Response(head + opts.body + foot, {
    status: opts.status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Language': 'en-US',
      // Browser cache. csp.ts downgrades this `public` to `private` on the way
      // out, because the nonce it stamps must not be replayed to a second
      // visitor. That downgrade is correct and stays.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      // Shared CDN cache — a separate header that csp.ts does not touch, because
      // it only rewrites Cache-Control. This is the one that costs money when it
      // is missing: a `private` response is one the CDN is forbidden to reuse, so
      // without this every crawler hit re-ran this render *plus* its
      // /api/products subrequest and the Postgres connection behind it. Google
      // and Bing alone walk 100+ URLs here, and each walk was billed as an edge
      // invocation and a function invocation rather than a cache hit.
      //
      // Caching the body is safe precisely because what gets stored is the
      // pre-nonce HTML: csp.ts is declared in netlify.toml on /*, is not itself
      // cached, and therefore runs on every request — cache hit or miss — minting
      // a fresh nonce each time. Nothing here varies per visitor otherwise; the
      // catalog and reviews are the same for everyone.
      //
      // Errors get a short window instead of the full one. A 404 is still worth
      // caching briefly because crawlers retry dead URLs persistently, but 60s
      // keeps a newly listed SKU from being shadowed for long.
      'Netlify-CDN-Cache-Control':
        (opts.status ?? 200) === 200
          ? 'public, s-maxage=300, stale-while-revalidate=86400, durable'
          : 'public, s-maxage=60',
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

// "The catalog is unreachable" is not the same claim as "this page does not exist",
// and answering a live product URL with 404 tells Google to drop it. A 503 says
// come back shortly and leaves the URL's indexing — and its tag status — intact.
function unavailable(): Response {
  const res = page({
    title: `Temporarily unavailable | ${STORE}`,
    description: 'This page is temporarily unavailable.',
    canonical: `${SITE}/`,
    jsonld: [],
    status: 503,
    robots: 'noindex, follow',
    body: `<nav class="crumbs"><a href="/">Home</a></nav><h1>One moment</h1><p class="lede">The catalog is waking up and this page couldn't be built just now. <a href="/">Try the catalog →</a></p>`,
  })
  const headers = new Headers(res.headers)
  headers.set('Retry-After', '30')
  // Never let an outage response be cached in place of the real page. Both
  // caches have to be told: Cache-Control governs the browser, and
  // Netlify-CDN-Cache-Control governs the shared CDN cache that page() now opts
  // into. Missing the second one would pin a 503 in front of a live product page
  // for everyone, for the whole window — strictly worse than the cold render it
  // was trying to avoid.
  headers.set('Cache-Control', 'no-store')
  headers.set('Netlify-CDN-Cache-Control', 'no-store')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
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
    image: `${SITE}/product-image/${encodeURIComponent(p.sku)}.png`,
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

  const newBadge = agg && agg.count > 0 ? '' : ` <span class="badge-new">New</span>`
  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/tools/${esc(p.niche)}">Tools for ${esc(nl)}</a> / ${esc(p.name)}</nav>` +
    `<span class="tag">${esc(cat)}</span> <span class="sku">${esc(p.sku)}</span>${newBadge}` +
    `<h1>${esc(p.name)}</h1>` +
    `<p class="lede">${esc(p.blurb)}</p>` +
    `<div class="specs">` +
    `<div class="row"><span>Built for</span><span>${esc(nl)}</span></div>` +
    `<div class="row"><span>Category</span><span>${esc(cat)}</span></div>` +
    `<div class="row"><span>Format</span><span>${esc(p.format)}</span></div>` +
    `<div class="row"><span>Spec</span><span>${esc(p.spec)}</span></div>` +
    `</div>` +
    `<div class="buy"><span class="price">${money(p.price)}</span>` +
    // nofollow: this CTA points at the storefront with a ?product= parameter, which
    // serves the homepage (and correctly canonicalises to "/"). Left followable, the
    // 64 product pages hand Googlebot 64 distinct URLs that all render the homepage —
    // 64 crawls, and 64 catalog fetches, to rediscover a page it already has. The
    // canonical stops them being indexed; nofollow stops them being fetched at all.
    `<a class="btn" data-product-cta rel="nofollow" href="/?product=${encodeURIComponent(p.sku)}">Add to cart in store →</a></div>` +
    `<p style="font-size:13px;color:var(--muted)">Digital delivery is immediate. Sales are final after access is provided, subject to the <a href="/refund-policy/">refund policy</a>.</p>` +
    reviewsHtml +
    relatedHtml +
    // The store's own ad-network slot (see ads-network-autopilot.mts, which
    // registers this deterministic slot key). Shows an ad from another
    // network tenant when one exists; hides itself automatically when none
    // do (see ads-network-embed.js's render()), so this is inert — not
    // broken — until a second tenant joins the network.
    `<div id="mnads-slot_self_jblessd" style="margin-top:28px"></div>` +
    `<script src="/ads-network-embed.js" data-slot="slot_self_jblessd" data-container-id="mnads-slot_self_jblessd"></script>`
  return page({
    title: `${p.name} — ${cat} | ${STORE}`,
    description: p.blurb,
    canonical: url,
    jsonld: [productLd, breadcrumb],
    ogType: 'product',
    image: `${SITE}/product-image/${encodeURIComponent(p.sku)}.png`,
    extraMeta:
      `<meta property="product:price:amount" content="${Number(p.price).toFixed(2)}"/>` +
      `<meta property="product:price:currency" content="USD"/>` +
      `<meta property="product:availability" content="in stock"/>` +
      `<meta property="og:price:amount" content="${Number(p.price).toFixed(2)}"/>` +
      `<meta property="og:price:currency" content="USD"/>`,
    body: body + `<script>window.trackMarketingEvent&&window.trackMarketingEvent('view_item',{currency:'USD',value:${Number(p.price)},items:[{item_id:${safeJson(p.sku)},item_name:${safeJson(p.name)},price:${Number(p.price)},quantity:1}],ecomm_prodid:${safeJson(p.sku)},ecomm_pagetype:'product',ecomm_totalvalue:${Number(p.price)}});document.querySelector('[data-product-cta]')?.addEventListener('click',function(){window.trackMarketingEvent&&window.trackMarketingEvent('add_to_cart',{currency:'USD',value:${Number(p.price)},items:[{item_id:${safeJson(p.sku)},item_name:${safeJson(p.name)},price:${Number(p.price)},quantity:1}],ecomm_prodid:${safeJson(p.sku)},ecomm_pagetype:'product',ecomm_totalvalue:${Number(p.price)}});});</script>`,
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
      const rating =
        agg && agg.count > 0
          ? `<div style="margin-top:6px" class="stars">${stars(agg.average)} <span style="color:var(--muted-2);font-size:12px">(${agg.count})</span></div>`
          : `<div style="margin-top:6px"><span class="badge-new">New</span></div>`
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
  const faqs = NICHE_FAQ[niche]
const deepDiveHtml = NICHE_DEEP_DIVE[niche] ? `<h2>How teams use this</h2>${NICHE_DEEP_DIVE[niche]}` : ''
const faqHtml = faqs
  ? `<h2>FAQ</h2>` +
    faqs.map((f) => `<div class="rev"><div class="who">${esc(f.q)}</div><p class="txt">${esc(f.a)}</p></div>`).join('')
  : ''
const faqLd = faqs
  ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    }
  : null
  
  const body =
  `<nav class="crumbs"><a href="/">Home</a> / Tools for ${esc(nl)}</nav>` +
  `<h1>AI tools for ${esc(nl)}</h1>` +
  `<p class="lede">${esc(intro)}</p>` +
  `<div class="grid">${cards}</div>` +
  deepDiveHtml +
  faqHtml +
  `<h2>Browse by role</h2><div class="roles">${otherRoles}</div>`
  return page({
    title: `AI tools for ${nl} — prompt packs, automations & agents | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [itemListLd, breadcrumb, ...(faqLd ? [faqLd] : [])],
    body,
  })
}
// ---- /blog ----
function renderBlog(): Response {
  const url = `${SITE}/blog`
  const intro = 'Guides, product updates, and AI workflow ideas from the MULTINICHE AI team.'
  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Blog</nav>` +
    `<h1>Blog</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    `<div id="soro-blog"></div>` +
    `<script src="https://app.trysoro.com/api/embed/781e67fc-d9d3-433d-8f18-761c67f869c8" defer></script>`

  return page({
    title: `Blog | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `${STORE} Blog`,
        url,
        description: intro,
      },
    ],
    body,
  })
}

// ---- /guides/:niche/:category ----
function renderGuide(g: Guide): Response {
  const url = `${SITE}/guides/${g.slug}`
  const nl = NICHE_LABEL[g.niche] ?? g.niche
  const cl = CATEGORY_LABEL[g.category] ?? g.category

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title.slice(0, 110),
    url,
    ...(g.publishedAt ? { datePublished: g.publishedAt } : {}),
    publisher: { '@type': 'Organization', name: STORE, url: SITE },
    about: { '@type': 'Thing', name: `${cl} for ${nl}` },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: `Tools for ${nl}`, item: `${SITE}/tools/${g.niche}` },
      { '@type': 'ListItem', position: 3, name: g.title, item: url },
    ],
  }

  // body_html is written by guides-generator.mts (our own scheduled job, not
  // raw user input) and constrained by prompt to h1/p/ul/li/a only — trusted
  // the same way the /blog embed script is. Rendered verbatim, no escaping.
  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/tools/${esc(g.niche)}">Tools for ${esc(nl)}</a> / ${esc(g.title)}</nav>` +
    `<span class="tag">Guide</span>` +
    g.bodyHtml +
    `<div class="buy"><a class="btn" href="/tools/${esc(g.niche)}">See ${esc(cl)} for ${esc(nl)} →</a></div>`

  return page({
    title: titleWithStore(g.title, 65),
    description: g.metaDescription,
    canonical: url,
    jsonld: [jsonld, breadcrumb],
    body,
  })
}

// ---- /guides (index) ----
function renderGuideIndex(guides: Guide[]): Response {
  const url = `${SITE}/guides`
  const intro = 'Guides for getting the most out of MULTINICHE AI tools, organized by role and category.'
  const cards = guides
    .map(
      (g) =>
        `<a class="pcard" href="/guides/${encodeURIComponent(g.slug)}"><div class="n">${esc(g.title)}</div><div class="b">${esc(g.metaDescription)}</div><div class="p">Read →</div></a>`,
    )
    .join('')
  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Guides</nav>` +
    `<h1>Guides</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    (cards ? `<div class="grid">${cards}</div>` : `<p style="color:var(--muted)">No guides published yet.</p>`)
  return page({
    title: `Guides — ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Guides', url, description: intro }],
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
    `<div class="buy"><a class="btn" rel="nofollow" href="/?product=${encodeURIComponent(p.sku)}">Get ${esc(p.productName)} →</a>` +
    `<a class="btn ghost" href="/">Run your own live proof</a></div>` +
    `<p style="font-size:13px;color:var(--muted)">Every tool in the catalog can be run live like this on your own task, free, before you buy.</p>`

  return page({
    title: titleWithStore(`Live proof: ${p.productName} in action`, 70),
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

// ---- /scorecard/:sku ----
interface ScorecardRun {
  id: string
  outcome: 'success' | 'partial' | 'failed'
  duration_ms: number | null
  created_at: string
}
interface Scorecard {
  sku: string
  scenarioPrompt: string
  methodologyVersion: number
  rollingStats: {
    total_runs: number
    success_rate: number | null
    avg_duration_ms: number | null
    last_run_at: string | null
  }
  runs: ScorecardRun[]
}

function outcomeTag(o: string): string {
  const color = o === 'success' ? 'var(--brass)' : o === 'partial' ? 'var(--muted)' : 'var(--danger)'
  return `<span style="color:${color};font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em">${esc(o)}</span>`
}

function renderScorecard(sc: Scorecard, product: ApiProduct | undefined): Response {
  const url = `${SITE}/scorecard/${encodeURIComponent(sc.sku)}`
  const name = product?.name ?? sc.sku
  const stats = sc.rollingStats
  const lastRunStr = stats.last_run_at ? stats.last_run_at.slice(0, 10) : 'never'

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Benchmark scorecard — ${name}`,
    url,
    description: `A running, dated record of ${name} run on a fixed test scenario — including failures.`,
  }

  const runsHtml = sc.runs.length
    ? sc.runs
        .map(
          (r) =>
            `<div class="rev"><div class="who">${esc(r.created_at.slice(0, 10))} · ${outcomeTag(r.outcome)}${r.duration_ms ? ` · ${r.duration_ms}ms` : ''}</div></div>`,
        )
        .join('')
    : `<p style="color:var(--muted)">No runs recorded yet.</p>`

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / <a href="/proof">Live proofs</a> / Scorecard: ${esc(name)}</nav>` +
    `<span class="tag">Benchmark scorecard</span>` +
    `<h1>${esc(name)} — benchmark scorecard</h1>` +
    `<p class="lede">A running, dated record of this product run on the same fixed test scenario every time — successes and failures both. See <a href="/methodology">how this is scored</a>.</p>` +
    `<div class="specs">` +
    `<div class="row"><span>Fixed scenario</span><span>${esc(sc.scenarioPrompt)}</span></div>` +
    `<div class="row"><span>Success rate</span><span>${stats.success_rate !== null ? stats.success_rate + '%' : '—'}</span></div>` +
    `<div class="row"><span>Total runs</span><span>${stats.total_runs}</span></div>` +
    `<div class="row"><span>Avg. duration</span><span>${stats.avg_duration_ms ? stats.avg_duration_ms + 'ms' : '—'}</span></div>` +
    `<div class="row"><span>Last run</span><span>${esc(lastRunStr)}</span></div>` +
    `<div class="row"><span>Methodology</span><span>v${sc.methodologyVersion}</span></div>` +
    `</div>` +
    `<h2>Run history</h2>` +
    runsHtml +
    (product
      ? `<div class="buy"><a class="btn" rel="nofollow" href="/?product=${encodeURIComponent(sc.sku)}">Get ${esc(name)} →</a>` +
        `<a class="btn ghost" href="/product/${encodeURIComponent(sc.sku)}">See product page</a></div>`
      : '')

  return page({
    title: titleWithStore(`${name} — benchmark scorecard`, 65),
    description: `Success rate, run history, and failures for ${name} — a dated benchmark run on a fixed scenario.`,
    canonical: url,
    jsonld: [jsonld],
    image: `${SITE}/product-image/${encodeURIComponent(sc.sku)}.png`,
    body,
  })
}

// ---- /methodology ----
function renderMethodology(): Response {
  const url = `${SITE}/methodology`
  const intro = 'How every benchmark scorecard on this site is run and scored — in full, including the current limits.'

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Methodology</nav>` +
    `<h1>How we score a benchmark run</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    `<h2>The scenario is fixed</h2>` +
    `<p class="lede">Each benchmarked product is tested against the same written scenario every time, so results are comparable week over week. Changing the scenario bumps a version number — a v1 result and a v2 result are never blended together.</p>` +
    `<h2>How a run is judged</h2>` +
    `<p class="lede">A run is marked <strong>success</strong> if the tool produced substantive output for the fixed scenario, and <strong>failed</strong> if it returned nothing usable or errored. Nothing is hidden: every run — including failures — is stored and shown in the product's run history.</p>` +
    `<h2>Current limitations</h2>` +
    `<p class="lede">Right now, outcome is judged mechanically (did the tool return real output for the scenario) — it is not yet independently graded for output quality by a human reviewer. That's the honest state of this today; we'll note here if and when that changes.</p>` +
    `<h2>Cadence</h2>` +
    `<p class="lede">Benchmarked products are re-run automatically once a week. A product with no runs yet simply hasn't been added to the benchmark set.</p>` +
    `<div class="buy"><a class="btn ghost" href="/proof">See all live proofs →</a></div>`

  return page({
    title: `Methodology — how benchmark scorecards are scored | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Methodology', url, description: intro },
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
          : `<div style="margin-top:6px"><span class="badge-new">New</span></div>`
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
    title: titleWithStore(a.seo?.metaTitle || headline),
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
  // Pre-filled so the demo is one tap away instead of a blank box — a
  // concrete, relatable "chaotic notes" scenario that shows real value on
  // the first run. Visitors can still clear it and describe their own task.
  const EXAMPLE_TASK =
    "Notes from today's call: John said pricing needs to go up, maybe 10%. Sarah worried about churn if we do that. " +
    'Need to decide by Friday. Someone needs to email the design team about the new mockups. Q3 roadmap still not ' +
    'finalized, revisit next week. Action items unclear, follow up needed.'

  const script =
    `(function(){` +
    `var f=document.getElementById('ft-form'),i=document.getElementById('ft-input'),b=document.getElementById('ft-run'),clr=document.getElementById('ft-clear');` +
    `var term=document.getElementById('ft-term'),out=document.getElementById('ft-out'),lab=document.getElementById('ft-lab'),cta=document.getElementById('ft-cta');` +
    `clr&&clr.addEventListener('click',function(){i.value='';i.focus();});` +
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
    `if(!got)throw new Error('empty');lastOut=ans;out.innerHTML=esc(ans);lab.textContent='demo · complete';window.trackMarketingEvent&&window.trackMarketingEvent('demo_complete',{item_id:sku,method:'free_tool'},{lead:true});` +
    // Build the CTA hrefs from variables rather than inline string literals. The
    // discovery crawler extracts links with a regex over raw HTML; a literal
    // href="/product/'+sku pattern makes it capture a bare "/product/" (up to the
    // quote) and report a phantom 404. Interpolating a variable keeps a quote
    // immediately after href=" so nothing bogus is captured.
    `var storeHref='/?product='+encodeURIComponent(sku),detailHref='/product/'+encodeURIComponent(sku);` +
    `cta.innerHTML='<div style=\"background:var(--brass);color:var(--ink);padding:14px 18px;border-radius:6px;margin-bottom:14px;font-size:14.5px\"><strong>That\\'s '+esc(name)+'</strong> — running on your own task, live. $'+parseFloat(price).toFixed(2)+' gets you the full version, permanently.</div>'+` +
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
    `style="width:100%;background:#0D111C;color:var(--paper);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-family:inherit;font-size:15px;resize:vertical">${esc(EXAMPLE_TASK)}</textarea>` +
    `<button class="btn" id="ft-run" type="submit" style="margin-top:10px">▶ Run it on my task</button>` +
    `<button class="btn ghost" id="ft-clear" type="button" style="margin-top:10px;margin-left:8px">Clear and write my own</button></form>` +
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

// ---- /custom ----  Paid, one-off custom-generated deliverable. Two states on
// one page: an intake form that starts a Stripe Checkout session for the
// flat $49 price, and — after Stripe redirects back with ?checkout=success —
// a "generating" state that calls /api/generate-custom-order and shows the
// result once it lands. Mirrors /free-tool's live, app-like feel, but the
// output here is paid-for and delivered by email as well as shown on screen.
function renderCustom(): Response {
  const url = `${SITE}/custom`
  const intro =
    'Describe exactly what you need — a prompt, an automation, a template, or an agent — and we build it for you. ' +
    'Not a demo of something in the catalog: a real, complete deliverable made for your situation. $49, delivered instantly and by email.'

  const script =
    `(function(){` +
    `var params=new URLSearchParams(location.search);` +
    `var form=document.getElementById('co-form'),cat=document.getElementById('co-category'),need=document.getElementById('co-need');` +
    `var policy=document.getElementById('co-policy'),submitBtn=document.getElementById('co-submit'),err=document.getElementById('co-err');` +
    `var esc=function(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});};` +
    `if(form){form.addEventListener('submit',function(e){e.preventDefault();startCheckout();});}` +
    `async function startCheckout(){` +
    `err.hidden=true;` +
    `if(!cat.value){err.textContent='Please choose a category.';err.hidden=false;return;}` +
    `if(need.value.trim().length<20){err.textContent='Please describe your need in a bit more detail (at least 20 characters).';err.hidden=false;return;}` +
    `if(!policy.checked){err.textContent='Please acknowledge the digital delivery and refund policy.';err.hidden=false;return;}` +
    `submitBtn.disabled=true;submitBtn.textContent='Starting checkout…';` +
    `try{` +
    `var r=await fetch('/api/create-custom-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},` +
    `body:JSON.stringify({category:cat.value,needDescription:need.value.trim(),digitalPolicyAccepted:true})});` +
    `var d=await r.json().catch(function(){return {};});` +
    `if(!r.ok||!d.url){throw new Error(d.error||'checkout-failed');}` +
    `location.href=d.url;` +
    `}catch(ex){err.textContent='Unable to start checkout. Please try again.';err.hidden=false;submitBtn.disabled=false;submitBtn.textContent='Get my custom deliverable — $49';}` +
    `}` +
    `if(params.get('checkout')==='success'){` +
    `var sessionId=params.get('session_id');` +
    `var intake=document.getElementById('co-intake'),gen=document.getElementById('co-generating'),result=document.getElementById('co-result');` +
    `if(intake)intake.hidden=true;if(gen)gen.hidden=false;` +
    `(async function(){` +
    `try{` +
    `var r=await fetch('/api/generate-custom-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sessionId})});` +
    `var d=await r.json().catch(function(){return {};});` +
    `if(!r.ok||!d.output){throw new Error(d.error||'generation-failed');}` +
    `if(gen)gen.hidden=true;` +
    `if(result){` +
    `result.hidden=false;` +
    `result.querySelector('.co-output').innerHTML=esc(d.output);` +
    `var blob=new Blob([d.output],{type:'text/markdown'});` +
    `var dl=result.querySelector('#co-download');` +
    `dl.href=URL.createObjectURL(blob);dl.download='custom-deliverable.md';` +
    `}` +
    `}catch(ex){` +
    `if(gen)gen.hidden=true;` +
    `if(result){result.hidden=false;result.querySelector('.co-output').innerHTML='<span class=\"co-hint\">Generation is taking a little longer than expected — your deliverable will still arrive by email shortly. If you don\\'t see it within a few minutes, reply to that email and we\\'ll sort it out.</span>';}` +
    `}` +
    `})();` +
    `}` +
    `})();`

  const body =
    `<nav class="crumbs"><a href="/">Home</a> / Custom deliverable</nav>` +
    `<span class="tag">Paid · built for you</span>` +
    `<h1>Get something built just for your need</h1>` +
    `<p class="lede">${esc(intro)}</p>` +
    `<div id="co-intake">` +
    `<form id="co-form" style="margin:18px 0">` +
    `<label style="display:block;margin-bottom:12px">Category` +
    `<select id="co-category" style="width:100%;margin-top:6px;background:#0D111C;color:var(--paper);border:1px solid var(--line);border-radius:6px;padding:10px 12px;font-family:inherit;font-size:15px">` +
    `<option value="">Choose one…</option>` +
    `<option value="prompts">Prompt Pack</option>` +
    `<option value="automations">Automation Blueprint</option>` +
    `<option value="templates">Doc Template</option>` +
    `<option value="agents">Agent Config</option>` +
    `</select></label>` +
    `<label style="display:block;margin-bottom:12px">What do you need?` +
    `<textarea id="co-need" rows="5" maxlength="4000" placeholder="Describe your situation in detail — the more specific, the better the result." ` +
    `style="width:100%;margin-top:6px;background:#0D111C;color:var(--paper);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-family:inherit;font-size:15px;resize:vertical"></textarea></label>` +
    `<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--muted);margin-bottom:14px">` +
    `<input type="checkbox" id="co-policy" style="margin-top:3px">` +
    `<span>I understand this is a custom digital product delivered instantly upon generation, and I acknowledge the <a href="/refund-policy">refund policy</a>.</span></label>` +
    `<p id="co-err" hidden style="color:var(--danger);font-size:13.5px;margin-bottom:12px"></p>` +
    `<button class="btn" id="co-submit" type="submit">Get my custom deliverable — $49</button></form>` +
    `</div>` +
    `<div class="proof" id="co-generating" hidden><div class="proof-bar">generating · building your deliverable, this takes about 20 seconds</div><div class="proof-out"><span class="co-cursor"></span></div></div>` +
    `<div id="co-result" hidden>` +
    `<h2>Your custom deliverable</h2>` +
    `<div class="proof"><div class="co-output" style="white-space:pre-wrap;padding:16px"></div></div>` +
    `<div class="buy"><a class="btn ghost" id="co-download" href="#">Download as .md</a></div>` +
    `<p style="font-size:13px;color:var(--muted)">This has also been emailed to you.</p>` +
    `</div>` +
    `<p style="font-size:13px;color:var(--muted)">Prefer something ready-made? <a href="/">Browse the full catalog</a>.</p>` +
    `<style>.co-cursor{display:inline-block;width:8px;height:14px;background:var(--brass);vertical-align:text-bottom;animation:cob 1s step-end infinite}` +
    `@keyframes cob{0%,100%{opacity:1}50%{opacity:0}}.co-hint{color:var(--muted)}</style>` +
    `<script>${script}</script>`

  return page({
    title: `Get a custom deliverable — built for your need, $49 | ${STORE}`,
    description: intro,
    canonical: url,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Custom deliverable',
        url,
        applicationCategory: 'BusinessApplication',
        offers: { '@type': 'Offer', price: '49', priceCurrency: 'USD' },
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
  // ---- /custom ----  paid custom-generated deliverable. Also purely
  // client-driven (calls /api/create-custom-checkout-session, then
  // /api/generate-custom-order after Stripe redirects back) — no server data.
  if (parts[0] === 'custom') {
    return renderCustom()
  }
  if (parts[0] === 'blog') {
  return renderBlog()
  }
  // ---- /proof (index) and /proof/:id ----  handled first: these don't need
  // the catalog, so a shared proof still renders even if /api/products is slow.
  if (parts[0] === 'proof') {
    if (parts[1]) {
      const id = decodeURIComponent(parts[1])
      const res = await getJsonOrFail<{ proof?: Proof | null }>(new URL(`/api/proof?id=${encodeURIComponent(id)}`, req.url))
      if (!res.ok) return unavailable()
      if (!res.data.proof) return notFound()
      return renderProof(res.data.proof)
    }
    // An index whose only job is to list things should not answer 200 with an
    // empty list because the API was slow — that is a thin page Google may treat
    // as a soft 404. A genuinely empty list still renders normally.
    const res = await getJsonOrFail<{ proofs?: Proof[] }>(new URL('/api/proof', req.url))
    if (!res.ok) return unavailable()
    return renderProofIndex(res.data.proofs ?? [])
  }

  // ---- /methodology ----  static, no data dependency.
  if (parts[0] === 'methodology') {
    return renderMethodology()
  }

  // ---- /scorecard/:sku ----  catalog-independent for the scorecard data
  // itself; the product lookup below (for name/CTA) reuses getCatalog(), which
  // fetches after this block runs — so it needs its own small catalog call.
  if (parts[0] === 'scorecard') {
    const sku = decodeURIComponent(parts[1] ?? '')
    if (!sku) return notFound()
    const res = await getJsonOrFail<{ scorecard?: Scorecard | null }>(
      new URL(`/api/scorecard?sku=${encodeURIComponent(sku)}`, req.url),
    )
    if (!res.ok) return unavailable()
    if (!res.data.scorecard) return notFound()
    const catalogProducts = await getCatalog(req)
    const product = catalogProducts?.find((p) => p.sku === sku)
    return renderScorecard(res.data.scorecard, product)
  }

  // ---- /updates (index) and /updates/:id ----  also catalog-independent.
  if (parts[0] === 'updates') {
    if (parts[1]) {
      // Ask for this exact campaign rather than scanning the recent-12 index, so an
      // update URL Google discovered months ago still resolves instead of 404ing
      // once a dozen newer campaigns push it out of the list.
      const id = Number(decodeURIComponent(parts[1]))
      if (!Number.isInteger(id) || id < 1) return notFound()
      const res = await getJsonOrFail<{ campaigns?: Campaign[] }>(
        new URL(`/api/marketing-agent?id=${id}`, req.url),
      )
      if (!res.ok) return unavailable()
      const c = res.data.campaigns?.[0]
      if (!c) return notFound()
      return renderUpdate(c)
    }
    const res = await getJsonOrFail<{ campaigns?: Campaign[] }>(new URL('/api/marketing-agent', req.url))
    if (!res.ok) return unavailable()
    return renderUpdatesIndex(res.data.campaigns ?? [])
  }

  // ---- /guides (index) and /guides/:niche/:category ----  also catalog-independent.
  if (parts[0] === 'guides') {
    if (parts[1] && parts[2]) {
      const niche = decodeURIComponent(parts[1])
      const category = decodeURIComponent(parts[2])
      const res = await getJsonOrFail<{ guide?: Guide | null }>(
        new URL(`/api/guides?niche=${encodeURIComponent(niche)}&category=${encodeURIComponent(category)}`, req.url),
      )
      if (!res.ok) return unavailable()
      if (!res.data.guide) return notFound()
      return renderGuide(res.data.guide)
    }
    const res = await getJsonOrFail<{ guides?: Guide[] }>(new URL('/api/guides', req.url))
    if (!res.ok) return unavailable()
    return renderGuideIndex(res.data.guides ?? [])
  }

  const products = await getCatalog(req)
  if (!products) return unavailable()

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
  path: ['/product/*', '/tools/*', '/proof', '/proof/*', '/use-cases', '/use-cases/*', '/updates', '/updates/*', '/free-tool', '/custom', '/blog', '/guides', '/guides/*', '/scorecard/*', '/methodology'],
  // Opt this function's responses into the CDN cache. Without it the
  // Netlify-CDN-Cache-Control header page() sets is inert, because an edge
  // function's response is never cached by default — it re-runs, and re-fetches
  // /api/products, on every single request.
  //
  // Ordering is unaffected: non-cached edge functions run ahead of cached ones,
  // so csp.ts (declared in netlify.toml on /*) still wraps this one and still
  // nonces every response on its way to the visitor.
  //
  // Safe against the "cached edge responses shadow static files" caveat — none of
  // the paths above have a static file behind them.
  cache: 'manual',
  }
