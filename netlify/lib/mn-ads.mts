// Multiniche Ads — first-party exchange glue for multinicheai.com.
//
// The browser never talks to a third-party origin (CSP would block it). These
// helpers are what /api/ads/{serve,run,click,offer} call:
//
//   1. If MN_ADS_ORIGIN is a real https origin (the published Multiniche Ads
//      app), proxy there and rewrite clickUrl/runUrl back to this host so the
//      tag stays same-origin. Those hits are the ones that land in the desk book.
//   2. Otherwise — and whenever the origin returns no fill or is unreachable —
//      house-fill from the live catalog. Real people, real page-native runs,
//      dollars are not the exchange ledger. Honest about that: house: true.
//
// Event ids: house fills are `h.{sku}.{rand}`. Exchange fills stay `ax_…`.

import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from './db.mjs'
import type { Product } from './catalog.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' } as const
const LICENSE = 'One-time license · MULTINICHE AI'
const STORE = 'MULTINICHE AI'
const PROXY_SERVE_MS = 8_000
const PROXY_RUN_MS = 25_000
const LIVE_TIMEOUT_MS = 12_000
const LIVE_MAX_TOKENS = 160

export type PageTask = { title: string; url: string; excerpt: string }

export function corsHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Cache-Control', 'no-store')
  return headers
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE }),
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export function requestOrigin(req: Request): string {
  const url = new URL(req.url)
  const proto = (req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')).split(',')[0]!.trim()
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host).split(',')[0]!.trim()
  return `${proto}://${host}`
}

export function adsOrigin(): string | null {
  const raw = (process.env.MN_ADS_ORIGIN ?? '').trim().replace(/\/+$/, '')
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.hostname === 'multinicheai.com' || u.hostname === 'www.multinicheai.com') return null
    return u.origin
  } catch {
    return null
  }
}

export function clipTask(raw: unknown): PageTask {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const excerpt = String(o.excerpt ?? o.text ?? o.body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    title: String(o.title ?? '').slice(0, 160),
    url: String(o.url ?? o.pageUrl ?? '').slice(0, 400),
    excerpt: excerpt.slice(0, 700),
  }
}

export function skuFromUrl(pageUrl: string): string {
  try {
    const u = new URL(pageUrl)
    const m = u.pathname.match(/\/product\/([^/]+)/)
    if (m?.[1]) return decodeURIComponent(m[1]).replace(/\.html?$/, '')
    return (u.searchParams.get('product') ?? '').trim()
  } catch {
    return ''
  }
}

export function parseHouseEvent(id: string): { sku: string } | null {
  if (!id.startsWith('h.')) return null
  const sku = id.slice(2).split('.')[0] ?? ''
  return sku ? { sku } : null
}

function rewriteValue(value: string, fromOrigin: string, toOrigin: string): string {
  if (value.startsWith(fromOrigin)) return toOrigin + value.slice(fromOrigin.length)
  return value
}

export function rewritePayload(payload: unknown, fromOrigin: string, toOrigin: string): unknown {
  if (!payload || typeof payload !== 'object') return payload
  if (Array.isArray(payload)) return payload.map((item) => rewritePayload(item, fromOrigin, toOrigin))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if ((k === 'clickUrl' || k === 'runUrl') && typeof v === 'string') {
      out[k] = rewriteValue(v, fromOrigin, toOrigin)
    } else if (v && typeof v === 'object') {
      out[k] = rewritePayload(v, fromOrigin, toOrigin)
    } else {
      out[k] = v
    }
  }
  return out
}

export async function proxyToOrigin(
  req: Request,
  pathWithQuery: string,
  timeoutMs: number,
): Promise<Response | null> {
  const origin = adsOrigin()
  if (!origin) return null
  const headers = new Headers()
  const accept = req.headers.get('Accept')
  if (accept) headers.set('Accept', accept)
  const contentType = req.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)
  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text()
  }
  try {
    const res = await fetch(origin + pathWithQuery, init)
    return res
  } catch {
    return null
  }
}

export async function proxiedJson(
  req: Request,
  pathWithQuery: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const origin = adsOrigin()
  if (!origin) return null
  const res = await proxyToOrigin(req, pathWithQuery, timeoutMs)
  if (!res || res.status >= 500 || res.status === 404) return null
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return rewritePayload(parsed, origin, requestOrigin(req)) as Record<string, unknown>
  } catch {
    return null
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

async function pickProduct(pageUrl: string, tags: string[], salt: string): Promise<Product | null> {
  const { products } = await loadCatalog()
  if (!products.length) return null
  const pageSku = skuFromUrl(pageUrl)
  let pool = products.filter((p) => p.sku !== pageSku)
  if (!pool.length) pool = products
  if (tags.length) {
    const tagged = pool.filter((p) =>
      tags.some(
        (t) =>
          p.niche === t ||
          p.category === t ||
          p.name.toLowerCase().includes(t) ||
          p.sku.toLowerCase() === t,
      ),
    )
    if (tagged.length) pool = tagged
  }
  return pool[hash(salt || pageUrl || 'home') % pool.length] ?? pool[0] ?? null
}

function eventIdFor(sku: string): string {
  return `h.${sku}.${Math.random().toString(36).slice(2, 10)}`
}

function pack(origin: string, product: Product, eventId: string, format: string) {
  const clickUrl = `${origin}/api/ads/click?e=${encodeURIComponent(eventId)}`
  const runUrl = `${origin}/api/ads/run?e=${encodeURIComponent(eventId)}`
  const destination = `${origin}/product/${encodeURIComponent(product.sku)}`
  const proof = {
    sku: product.sku,
    spec: product.spec,
    sample: product.blurb,
    license: LICENSE,
  }
  const offer = {
    type: 'SpecOffer',
    protocol: 'multiniche-ads/1',
    brand: STORE,
    product: product.name,
    sku: product.sku,
    price: product.price,
    currency: 'USD',
    license: LICENSE,
    spec: product.spec,
    sample: product.blurb,
    destination,
    clickUrl,
    runUrl,
    acceptsTask: true,
  }
  return {
    ok: true,
    fill: true,
    house: true,
    eventId,
    format,
    brand: STORE,
    headline: product.name,
    subhead: product.format,
    body: product.blurb,
    cta: 'Run it on this page',
    imageUrl: `${origin}/product-image/${encodeURIComponent(product.sku)}.png`,
    owned: true,
    host: 'multinicheai.com',
    price: 0,
    quality: 0.8,
    clickUrl,
    runUrl,
    proof,
    offer,
    event: { id: eventId, outcome: 'won', brand: STORE, headline: product.name, price: 0, quality: 0.8 },
  }
}

export async function houseServe(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const tags = (url.searchParams.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  const pageUrl = url.searchParams.get('url') ?? ''
  const format = url.searchParams.get('format') || 'display'
  const pageview = url.searchParams.get('pageview') || ''
  const product = await pickProduct(pageUrl, tags, pageview + (url.searchParams.get('slot') ?? ''))
  if (!product) return json({ ok: true, fill: false, house: true })
  return json(pack(requestOrigin(req), product, eventIdFor(product.sku), format))
}

export async function houseOffer(req: Request): Promise<Response> {
  const served = await houseServe(req)
  const body = (await served.json()) as Record<string, unknown>
  if (!body.fill) return json({ ok: true, protocol: 'multiniche-ads/1', fill: false, house: true })
  return json({
    ok: true,
    protocol: 'multiniche-ads/1',
    fill: true,
    house: true,
    eventId: body.eventId,
    quality: body.quality,
    auctionPrice: 0,
    offer: body.offer,
    runUrl: body.runUrl,
    clickUrl: body.clickUrl,
  })
}

function bindSpec(sample: string, spec: string, task: PageTask): string {
  const where = task.title.trim() || hostOf(task.url) || 'this page'
  const clip = task.excerpt.slice(0, 160)
  const lines = [`On “${where}”`]
  if (clip) lines.push(clip + (task.excerpt.length > 160 ? '…' : ''))
  if (spec) lines.push(spec)
  if (sample) lines.push(sample)
  return lines.join('\n')
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

async function findProduct(sku: string): Promise<Product | null> {
  const { products } = await loadCatalog()
  return products.find((p) => p.sku === sku) ?? null
}

async function executeHouse(spec: string, sample: string, task: PageTask, live: boolean): Promise<{ output: string; live: boolean }> {
  const bound = bindSpec(sample, spec, task)
  if (!live) return { output: bound, live: false }
  const key = process.env.ANTHROPIC_API_KEY
  const hasTask = task.excerpt.length >= 40 || task.title.trim().length >= 8
  if (!key || !hasTask) return { output: bound, live: false }
  try {
    const anthropic = new Anthropic({ apiKey: key })
    const message = await anthropic.messages.create(
      {
        model: 'claude-sonnet-5',
        max_tokens: LIVE_MAX_TOKENS,
        system:
          'You execute a digital instrument against a live page.\n' +
          'The spec is the METHOD — the shape of the job. The page excerpt is the only source of FACTS.\n' +
          "Replace any example names, numbers, calendars, or scenarios inside the spec with what the page actually says.\n" +
          "Produce the job the spec describes using only page facts. If a figure the method wants is missing, skip that line — do not copy the spec's sample.\n" +
          'Output only the completed job. No pitch, no preamble, no markdown fences. Max 70 words.\n\nSpec:\n' +
          spec,
        messages: [
          {
            role: 'user',
            content: `The page is the task.\nTitle: ${task.title || '(untitled)'}\nURL: ${task.url || '(none)'}\nExcerpt:\n${task.excerpt || '(empty)'}`,
          },
        ],
      },
      { timeout: LIVE_TIMEOUT_MS },
    )
    const text = message.content.find((b) => b.type === 'text')?.text?.trim() ?? ''
    if (!text) return { output: bound, live: false }
    return { output: text.slice(0, 900), live: true }
  } catch {
    return { output: bound, live: false }
  }
}

export async function houseRun(req: Request): Promise<Response> {
  const url = new URL(req.url)
  let eventId = url.searchParams.get('e') ?? ''
  let live = req.method === 'POST'
  let task = clipTask({
    title: url.searchParams.get('title') ?? '',
    url: url.searchParams.get('url') ?? '',
    excerpt: url.searchParams.get('excerpt') ?? '',
  })
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    eventId = String(body.e ?? body.eventId ?? eventId)
    task = clipTask({ ...body, url: body.url ?? body.pageUrl })
  }
  const parsed = parseHouseEvent(eventId)
  if (!parsed) return json({ ok: false, error: 'Missing run id' }, 400)
  const product = await findProduct(parsed.sku)
  if (!product) return json({ ok: false, fill: false, error: 'No spec on this fill' }, 404)
  const ran = await executeHouse(product.spec, product.blurb, task, live)
  return json({
    ok: true,
    ran: true,
    billed: false,
    house: true,
    live: ran.live,
    output: ran.output,
    sample: ran.output,
    spec: product.spec,
    sku: product.sku,
    license: LICENSE,
    taskTitle: task.title,
  })
}

export async function houseClick(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('e') ?? ''
  const parsed = parseHouseEvent(eventId)
  const origin = requestOrigin(req)
  const dest = parsed ? `${origin}/product/${encodeURIComponent(parsed.sku)}` : `${origin}/`
  return new Response(null, {
    status: 302,
    headers: { Location: dest, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  })
}

export { PROXY_SERVE_MS, PROXY_RUN_MS }
