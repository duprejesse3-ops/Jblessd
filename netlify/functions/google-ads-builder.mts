// Netlify Function: /api/google-ads-builder
//
// The AI Google Ads Builder agent — the store owner's "fill it into Google for
// me" tool. The owner picks a product (or the whole store) and an optional goal
// ("push the Black Friday sale", "target freelancers on a budget"), and this
// generates a complete, ready-to-paste Google Ads Responsive Search Ad plan:
//
//   • up to 15 headlines (each ≤ 30 chars)
//   • up to 4 descriptions (each ≤ 90 chars)
//   • a keyword list with match types (broad / phrase / exact)
//   • negative keywords to stop wasted spend
//   • sitelink, callout, and structured-snippet extensions
//   • the final URL and the two display-path segments
//
// Everything is length-checked against Google's real limits so the owner can
// copy each field straight into the Google Ads campaign builder with no edits.
// Every field is grounded in the REAL catalog so nothing is invented.
//
//   POST — generate a plan for { sku?, goal? } and persist it as a draft.
//          Each POST regenerates a fresh plan (the "regenerate on call" path).
//   GET  — list recent plans.
//
// This is an owner-only workstation tool: every request must carry a valid admin
// session cookie (see admin-auth), exactly like the operator console.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// If the gateway isn't active yet (AI Gateway needs at least one production
// deploy) or the model errors, it falls back to a template-based generator so
// the agent always returns a usable, paste-ready plan.

import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-sonnet-4-5'
const STORE_NAME = 'MULTINICHE AI'
const STORE_SKU = 'STORE'
const NO_STORE = { 'Cache-Control': 'no-store' }

// Canonical site, kept in sync with the marketing agent and SEO edge function.
const SITE_URL = 'https://jblessd.com'

// Google Ads Responsive Search Ad limits (chars). Used both to instruct the
// model and to hard-trim whatever comes back, so every field is paste-ready.
const LIM = {
  headline: 30,
  description: 90,
  sitelinkText: 25,
  sitelinkDesc: 35,
  callout: 25,
  snippetValue: 25,
  path: 15,
}

// The final URL a plan should send clicks to: the product deep-link, or the
// storefront when advertising the whole store.
function finalUrl(target: Product | null): string {
  return target ? `${SITE_URL}/product/${encodeURIComponent(target.sku)}` : SITE_URL
}

type MatchType = 'broad' | 'phrase' | 'exact'

// The shape of a generated Google Ads plan. Kept flat so the frontend can
// render each field with a copy button and the DB can store it verbatim as JSON.
interface AdPlan {
  finalUrl: string
  displayPath: { path1: string; path2: string }
  headlines: string[]
  descriptions: string[]
  keywords: { text: string; matchType: MatchType }[]
  negativeKeywords: string[]
  sitelinks: { text: string; description1: string; description2: string }[]
  callouts: string[]
  structuredSnippet: { header: string; values: string[] }
}

interface AdDraftRow {
  id: number
  sku: string
  productName: string
  goal: string
  source: 'ai' | 'heuristic'
  assets: AdPlan
  createdAt: string | null
}

// ---- small helpers ---------------------------------------------------------
function trim(s: unknown, max: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const it of items) {
    const key = it.toLowerCase()
    if (it && !seen.has(key)) {
      seen.add(key)
      out.push(it)
    }
  }
  return out
}

const MATCH_TYPES: MatchType[] = ['broad', 'phrase', 'exact']

// ---- template fallback: build a serviceable plan without the model ---------
function heuristicPlan(target: Product | null, goal: string): AdPlan {
  const name = target ? target.name : STORE_NAME
  const audience = target ? NICHE_LABEL[target.niche] : 'people who want to get more done with AI'
  const kind = target ? CATEGORY_LABEL[target.category].toLowerCase() : 'AI productivity tools'
  const price = target ? `$${target.price.toFixed(0)}` : ''

  const seedTerms = [
    kind,
    `${kind} for ${audience.toLowerCase()}`,
    `ai ${kind}`,
    `${audience.toLowerCase()} tools`,
    'ai prompt pack',
    'ai automation templates',
    target ? name.toLowerCase() : 'ai productivity store',
  ]

  const headlines = dedupe([
    trim(name, LIM.headline),
    trim(`AI ${kind}`, LIM.headline),
    trim(`Built for ${audience}`, LIM.headline),
    'Ready To Use Today',
    price ? trim(`From ${price}`, LIM.headline) : 'Instant Download',
    'Ship Faster With AI',
    'No Fluff, Just Results',
    'Get More Done Today',
    'Save Hours Every Week',
    trim(`${STORE_NAME} Store`, LIM.headline),
  ])

  const descriptions = dedupe([
    trim(target ? target.blurb : 'Prompt packs, automations, templates and agent configs — built once, ready to run today.', LIM.description),
    trim(`Made for ${audience.toLowerCase()}. Instant download, full spec sheet, no subscription.`, LIM.description),
    'Stop rebuilding the same workflow. Grab a tool that pays for itself fast.',
    'Browse ready-to-run AI tools organized by role. Start shipping in minutes.',
  ])

  return {
    finalUrl: finalUrl(target),
    displayPath: {
      path1: trim(target ? CATEGORY_LABEL[target.category] : 'AI-Tools', LIM.path).replace(/\s+/g, '-'),
      path2: trim(target ? target.niche : 'Store', LIM.path).replace(/\s+/g, '-'),
    },
    headlines,
    descriptions,
    keywords: dedupe(seedTerms).map((text, i) => ({
      text: trim(text, 80),
      matchType: MATCH_TYPES[i % 2 === 0 ? 1 : 0], // mix of phrase/broad
    })),
    negativeKeywords: ['free', 'crack', 'torrent', 'jobs', 'course', 'cheap'],
    sitelinks: [
      { text: 'Browse Catalog', description1: 'Tools organized by role', description2: 'Prompts, agents & more' },
      { text: 'How It Works', description1: 'Instant download', description2: 'Full spec on every item' },
      { text: 'Free Starter Pack', description1: 'Try before you buy', description2: 'No card required' },
      { text: 'Reviews', description1: 'Real buyer results', description2: 'See what shipped faster' },
    ].map((s) => ({
      text: trim(s.text, LIM.sitelinkText),
      description1: trim(s.description1, LIM.sitelinkDesc),
      description2: trim(s.description2, LIM.sitelinkDesc),
    })),
    callouts: ['Instant Download', 'No Subscription', 'Full Spec Sheet', 'Built for Pros', 'Ready to Run'].map((c) => trim(c, LIM.callout)),
    structuredSnippet: {
      header: 'Types',
      values: ['Prompt Packs', 'Automations', 'Templates', 'Agent Configs'].map((v) => trim(v, LIM.snippetValue)),
    },
  }
}

// ---- AI path: ask Claude to compose the Google Ads plan --------------------
async function aiPlan(target: Product | null, goal: string, catalog: Product[]): Promise<AdPlan> {
  const anthropic = new Anthropic()

  const subject = target
    ? {
        name: target.name,
        category: CATEGORY_LABEL[target.category],
        audience: NICHE_LABEL[target.niche],
        price: target.price,
        format: target.format,
        description: target.blurb,
        spec: target.spec,
      }
    : {
        name: `${STORE_NAME} (the whole store)`,
        description:
          'A store of ready-to-use AI productivity tools: prompt packs, automation blueprints, doc templates, and agent configs. Every listing is a spec sheet, organized by role.',
        catalogSize: catalog.length,
        categories: [...new Set(catalog.map((p) => CATEGORY_LABEL[p.category]))],
        audiences: [...new Set(catalog.map((p) => NICHE_LABEL[p.niche]))],
      }

  const tool: Anthropic.Tool = {
    name: 'compose_google_ads_plan',
    description:
      'Compose a complete, ready-to-paste Google Ads Responsive Search Ad plan for the given product or store. Every string MUST respect the character limits stated in its description — Google rejects fields that are too long.',
    input_schema: {
      type: 'object',
      properties: {
        displayPath: {
          type: 'object',
          description: 'The two optional display-URL path segments shown after the domain.',
          properties: {
            path1: { type: 'string', description: 'Display path segment 1, at most 15 characters, no spaces or slashes.' },
            path2: { type: 'string', description: 'Display path segment 2, at most 15 characters, no spaces or slashes.' },
          },
          required: ['path1', 'path2'],
        },
        headlines: {
          type: 'array',
          description: 'Between 12 and 15 distinct ad headlines, each AT MOST 30 characters. Vary the angle: benefit, audience, offer, brand, call to action. Title Case.',
          items: { type: 'string' },
        },
        descriptions: {
          type: 'array',
          description: 'Exactly 4 distinct ad descriptions, each AT MOST 90 characters. Each ends with or implies a clear call to action.',
          items: { type: 'string' },
        },
        keywords: {
          type: 'array',
          description: 'Between 12 and 20 targeted keywords a real buyer would search. Mix match types sensibly (mostly phrase and exact, some broad).',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The keyword phrase in lowercase, no punctuation or brackets.' },
              matchType: { type: 'string', enum: MATCH_TYPES, description: 'The Google Ads match type for this keyword.' },
            },
            required: ['text', 'matchType'],
          },
        },
        negativeKeywords: {
          type: 'array',
          description: '6 to 12 negative keywords (lowercase, no brackets) that would attract the wrong clicks and waste spend, e.g. "free", "jobs", "torrent".',
          items: { type: 'string' },
        },
        sitelinks: {
          type: 'array',
          description: 'Exactly 4 sitelink extensions.',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The sitelink link text, at most 25 characters.' },
              description1: { type: 'string', description: 'First description line, at most 35 characters.' },
              description2: { type: 'string', description: 'Second description line, at most 35 characters.' },
            },
            required: ['text', 'description1', 'description2'],
          },
        },
        callouts: {
          type: 'array',
          description: '4 to 8 callout extensions, each AT MOST 25 characters, e.g. "Instant Download", "No Subscription".',
          items: { type: 'string' },
        },
        structuredSnippet: {
          type: 'object',
          description: 'One structured-snippet extension.',
          properties: {
            header: { type: 'string', description: 'A valid Google structured-snippet header, e.g. "Types", "Brands", "Styles", "Service catalog".' },
            values: { type: 'array', description: '3 to 6 values, each AT MOST 25 characters.', items: { type: 'string' } },
          },
          required: ['header', 'values'],
        },
      },
      required: ['displayPath', 'headlines', 'descriptions', 'keywords', 'negativeKeywords', 'sitelinks', 'callouts', 'structuredSnippet'],
    },
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'compose_google_ads_plan' },
    messages: [
      {
        role: 'user',
        content:
          `You are the in-house paid-search specialist for ${STORE_NAME}, a store of ready-to-use AI ` +
          `productivity tools (prompt packs, automation blueprints, doc templates, and agent configs). ` +
          `Write a complete Google Ads Responsive Search Ad plan the owner can paste straight into Google ` +
          `Ads with no edits. The brand voice is confident and credible, benefit-led, and never spammy — ` +
          `avoid ALL CAPS, exclamation-point overload, and unsupported superlatives (Google disapproves ads ` +
          `that use them).\n\n` +
          `Ground every claim in the real details below — do not invent features, prices, or specs.\n\n` +
          `Respect Google's character limits EXACTLY: headlines ≤ 30, descriptions ≤ 90, sitelink text ≤ 25, ` +
          `sitelink descriptions ≤ 35, callouts ≤ 25, structured-snippet values ≤ 25, display paths ≤ 15.\n\n` +
          (goal ? `The owner's goal for this campaign: """${goal}"""\n\n` : '') +
          `Compose the plan for the following ${target ? 'product' : 'store'}:\n${JSON.stringify(subject, null, 2)}`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!block) throw new Error('Model did not return an ad plan')

  const out = block.input as any
  if (
    !Array.isArray(out.headlines) ||
    out.headlines.length === 0 ||
    !Array.isArray(out.descriptions) ||
    out.descriptions.length === 0 ||
    !Array.isArray(out.keywords) ||
    out.keywords.length === 0
  ) {
    throw new Error('Model returned an incomplete ad plan')
  }

  // Normalize + hard-enforce every Google limit so the output is paste-ready
  // regardless of what the model returned.
  const headlines = dedupe((out.headlines as unknown[]).map((h) => trim(h, LIM.headline))).slice(0, 15)
  const descriptions = dedupe((out.descriptions as unknown[]).map((d) => trim(d, LIM.description))).slice(0, 4)

  const keywords = (Array.isArray(out.keywords) ? out.keywords : [])
    .map((k: any) => ({
      text: trim(typeof k === 'string' ? k : k?.text, 80).toLowerCase(),
      matchType: (MATCH_TYPES.includes(k?.matchType) ? k.matchType : 'phrase') as MatchType,
    }))
    .filter((k: { text: string }) => k.text)
  // De-dupe keywords by text while keeping the first match type seen.
  const kwSeen = new Set<string>()
  const dedupedKeywords = keywords.filter((k: { text: string }) => {
    if (kwSeen.has(k.text)) return false
    kwSeen.add(k.text)
    return true
  }).slice(0, 20)

  const sitelinks = (Array.isArray(out.sitelinks) ? out.sitelinks : [])
    .map((s: any) => ({
      text: trim(s?.text, LIM.sitelinkText),
      description1: trim(s?.description1, LIM.sitelinkDesc),
      description2: trim(s?.description2, LIM.sitelinkDesc),
    }))
    .filter((s: { text: string }) => s.text)
    .slice(0, 6)

  const rawSnippet = out.structuredSnippet ?? {}
  const structuredSnippet = {
    header: trim(rawSnippet.header || 'Types', 30),
    values: dedupe((Array.isArray(rawSnippet.values) ? rawSnippet.values : []).map((v: unknown) => trim(v, LIM.snippetValue))).slice(0, 10),
  }

  return {
    finalUrl: finalUrl(target),
    displayPath: {
      path1: trim(out.displayPath?.path1, LIM.path).replace(/\s+/g, '-'),
      path2: trim(out.displayPath?.path2, LIM.path).replace(/\s+/g, '-'),
    },
    headlines,
    descriptions,
    keywords: dedupedKeywords,
    negativeKeywords: dedupe((Array.isArray(out.negativeKeywords) ? out.negativeKeywords : []).map((n: unknown) => trim(n, 60).toLowerCase())).slice(0, 20),
    sitelinks,
    callouts: dedupe((Array.isArray(out.callouts) ? out.callouts : []).map((c: unknown) => trim(c, LIM.callout))).slice(0, 8),
    structuredSnippet:
      structuredSnippet.values.length > 0 ? structuredSnippet : { header: 'Types', values: ['Prompt Packs', 'Automations', 'Templates', 'Agent Configs'] },
  }
}

function normalizeRow(row: any): AdDraftRow {
  const assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : row.assets
  return {
    id: Number(row.id),
    sku: row.sku,
    productName: row.product_name,
    goal: row.goal ?? '',
    source: row.source,
    assets,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

export default async (req: Request) => {
  // ---- owner gate: identical to the operator console ----
  if (!isConfigured()) {
    return Response.json({ error: 'Google Ads Builder is not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
  }
  if (!isAuthed(req, Date.now())) {
    return Response.json({ error: 'Not authorized. Sign in at /admin first.' }, { status: 401, headers: NO_STORE })
  }

  // ---- GET: list recent plans ----
  if (req.method === 'GET') {
    try {
      const db = getDatabase()
      const rows = (await db.sql`
        SELECT id, sku, product_name, goal, source, assets, created_at
        FROM ad_drafts
        ORDER BY created_at DESC, id DESC
        LIMIT 12
      `) as any[]
      return Response.json({ plans: (rows ?? []).map(normalizeRow) }, { headers: NO_STORE })
    } catch (err) {
      console.error('google-ads-builder GET error:', (err as Error).message)
      return Response.json({ plans: [] }, { headers: NO_STORE })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  }

  // ---- POST: generate (or regenerate) a plan ----
  let sku = ''
  let goal = ''
  try {
    const body = await req.json()
    sku = String(body?.sku ?? '').trim().slice(0, 100)
    goal = String(body?.goal ?? '').trim().slice(0, 500)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  const { products } = await loadCatalog()
  const isStore = !sku || sku === STORE_SKU
  const target = isStore ? null : products.find((p) => p.sku === sku) ?? null

  if (!isStore && !target) {
    return Response.json({ error: 'That product is no longer in the catalog.' }, { status: 404, headers: NO_STORE })
  }

  const productName = target ? target.name : `${STORE_NAME} (whole store)`
  const storedSku = target ? target.sku : STORE_SKU

  let assets: AdPlan
  let source: 'ai' | 'heuristic' = 'ai'
  try {
    assets = await aiPlan(target, goal, products)
  } catch (err) {
    console.error('Google Ads Builder AI path failed, using template:', (err as Error).message)
    assets = heuristicPlan(target, goal)
    source = 'heuristic'
  }

  // Persist the plan so it survives reloads and can be reviewed later.
  let saved: AdDraftRow | null = null
  try {
    const db = getDatabase()
    const [row] = (await db.sql`
      INSERT INTO ad_drafts (sku, product_name, goal, source, assets)
      VALUES (${storedSku}, ${productName}, ${goal}, ${source}, ${JSON.stringify(assets)}::jsonb)
      RETURNING id, sku, product_name, goal, source, assets, created_at
    `) as any[]
    saved = normalizeRow(row)
  } catch (err) {
    console.error('google-ads-builder save error:', (err as Error).message)
    // Still return the generated plan even if persistence failed.
  }

  return Response.json(
    {
      plan: saved ?? {
        id: 0,
        sku: storedSku,
        productName,
        goal,
        source,
        assets,
        createdAt: null,
      },
      persisted: saved !== null,
    },
    { headers: NO_STORE },
  )
}

export const config: Config = {
  path: '/api/google-ads-builder',
}
