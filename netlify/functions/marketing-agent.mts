// Netlify Function: /api/marketing-agent
//
// The AI Marketing Agent. The store owner picks a product (or the whole store)
// and an optional goal ("push the Black Friday sale", "target developers"), and
// this generates a complete, ready-to-publish marketing campaign: a tagline,
// social posts for X/LinkedIn/Instagram, a launch email, SEO metadata, and a set
// of ad headlines — each grounded in the real catalog so nothing is invented.
// Every campaign also carries a direct link to the product (or store) page and a
// shareable image, so posts and emails drive traffic instead of dead-ending.
//
//   POST — generate a campaign for { sku?, goal? } and persist it.
//   GET  — list recent campaigns.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// If the gateway isn't active yet (AI Gateway needs at least one production
// deploy) or the model errors, it falls back to a template-based generator so
// the feature always returns a usable campaign.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-sonnet-4-5'
const STORE_NAME = 'MULTINICHE AI'
const STORE_SKU = 'STORE'

// Canonical site + the shareable image every campaign can attach. Kept in sync
// with the SEO edge function (netlify/edge-functions/seo.ts), which uses the
// same domain and OG image for product/store structured data.
const SITE_URL = 'https://jblessd.com'
const CAMPAIGN_IMAGE = `${SITE_URL}/multiniche-ai-og.png`

// The exact page a campaign should drive traffic to: the product deep-link, or
// the storefront when marketing the whole store.
function campaignLink(target: Product | null): string {
  return target ? `${SITE_URL}/product/${encodeURIComponent(target.sku)}` : SITE_URL
}

// The shape of a generated campaign. Kept flat so the frontend can render each
// channel with a copy button and the DB can store it verbatim as JSON.
interface Campaign {
  tagline: string
  tweets: string[]
  linkedin: string
  instagram: string
  email: { subject: string; body: string }
  seo: { metaTitle: string; metaDescription: string }
  adHeadlines: string[]
  // Where the campaign sends people, and the image to attach to posts/emails.
  link: string
  image: string
}

interface CampaignRow {
  id: number
  sku: string
  productName: string
  goal: string
  source: 'ai' | 'heuristic'
  assets: Campaign
  createdAt: string | null
}

// ---- template fallback: build a serviceable campaign without the model ----
function heuristicCampaign(target: Product | null, goal: string): Campaign {
  const name = target ? target.name : `${STORE_NAME} — the full toolkit`
  const audience = target ? NICHE_LABEL[target.niche] : 'people who want to get more done with AI'
  const kind = target ? CATEGORY_LABEL[target.category].toLowerCase() : 'AI productivity tools'
  const desc = target ? target.blurb : 'Prompt packs, automation blueprints, doc templates, and agent configs — built once, ready to put to work today.'
  const price = target ? `$${target.price.toFixed(2)}` : 'every budget'
  const angle = goal ? ` ${goal}.` : ''
  const link = campaignLink(target)
  const cta = target ? 'Grab it now' : 'Start browsing'

  return {
    tagline: target
      ? `${name}: ${desc}`
      : `${STORE_NAME}: load the tool you need and ship faster today.`,
    tweets: [
      `New in the shop → ${name}. ${desc} Built for ${audience.toLowerCase()}.${angle} ${price === 'every budget' ? '' : `Just ${price} —`} ${cta}: ${link}`.replace(/\s+/g, ' ').trim(),
      `Stop rebuilding the same workflow from scratch. ${name} is ready to run today and pays for itself fast. See it → ${link}`,
      `If you're in ${audience.toLowerCase()}, this one saves you hours: ${name}. ${cta} → ${link}`,
    ],
    linkedin:
      `Introducing ${name}.\n\n${desc}\n\n` +
      `We built it for ${audience.toLowerCase()} who'd rather ship than fiddle — real specs, real results, no fluff.${angle ? `\n\n${goal}.` : ''}\n\n` +
      `${price === 'every budget' ? 'Priced for every budget' : `It's ${price}`}, and it's ready the moment you check out. ${cta}: ${link}`,
    instagram:
      `${name} just dropped ✦\n\n${desc}\n\nBuilt for ${audience.toLowerCase()} — ${cta.toLowerCase()} at the link in bio or ${link}\n\n#AI #productivity #${kind.replace(/[^a-z0-9]+/gi, '')} #tools`,
    email: {
      subject: target ? `New: ${name} — ready to use today` : `Meet ${STORE_NAME}`,
      body:
        `Hi there,\n\n` +
        `We just added ${name} to the shop, and it's built to save you time from day one. ${desc}\n\n` +
        `It's made for ${audience.toLowerCase()}, and like everything here it comes with a full spec sheet so you know exactly what you're getting${price === 'every budget' ? '' : ` — all for ${price}`}.${angle ? `\n\n${goal}.` : ''}\n\n` +
        `${cta} here: ${link}\n\n— The ${STORE_NAME} team`,
    },
    seo: {
      metaTitle: `${name} | ${STORE_NAME}`.slice(0, 60),
      metaDescription: `${desc} Built for ${audience.toLowerCase()}.`.slice(0, 155),
    },
    adHeadlines: [
      name.slice(0, 40),
      `Built for ${audience}`.slice(0, 40),
      `Ready-to-run ${kind}`.slice(0, 40),
    ],
    link,
    image: CAMPAIGN_IMAGE,
  }
}

// ---- AI path: ask Claude to compose the campaign ----
async function aiCampaign(target: Product | null, goal: string, catalog: Product[]): Promise<Campaign> {
  const anthropic = new Anthropic()

  const link = campaignLink(target)

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
    name: 'compose_campaign',
    description: 'Compose a complete, ready-to-publish marketing campaign for the given product or store.',
    input_schema: {
      type: 'object',
      properties: {
        tagline: { type: 'string', description: 'One punchy line that captures the offer.' },
        tweets: {
          type: 'array',
          description: 'Exactly 3 standalone posts for X/Twitter, each under 260 characters. At least one must end with a call to action that includes the exact page URL provided.',
          items: { type: 'string' },
        },
        linkedin: { type: 'string', description: 'A professional LinkedIn post, 2-4 short paragraphs, closing with a call to action that links to the exact page URL provided.' },
        instagram: { type: 'string', description: 'An Instagram caption with a clear call to action and a few relevant hashtags.' },
        email: {
          type: 'object',
          description: 'A short marketing email.',
          properties: {
            subject: { type: 'string', description: 'A compelling subject line under 60 characters.' },
            body: { type: 'string', description: 'The email body: warm, benefit-led, and concise, ending with a clear call to action that includes the exact page URL provided.' },
          },
          required: ['subject', 'body'],
        },
        seo: {
          type: 'object',
          description: 'Search metadata for the product/store page.',
          properties: {
            metaTitle: { type: 'string', description: 'An SEO title tag, at most 60 characters.' },
            metaDescription: { type: 'string', description: 'An SEO meta description, at most 155 characters.' },
          },
          required: ['metaTitle', 'metaDescription'],
        },
        adHeadlines: {
          type: 'array',
          description: 'Exactly 3 short paid-ad headlines, each at most 40 characters.',
          items: { type: 'string' },
        },
      },
      required: ['tagline', 'tweets', 'linkedin', 'instagram', 'email', 'seo', 'adHeadlines'],
    },
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'compose_campaign' },
    messages: [
      {
        role: 'user',
        content:
          `You are the in-house marketing agent for ${STORE_NAME}, a store of ready-to-use AI ` +
          `productivity tools (prompt packs, automation blueprints, doc templates, and agent configs). ` +
          `The brand voice is confident and credible, but warm and sales-oriented: lead with the outcome ` +
          `and the benefit, make the value obvious, and always close with a clear call to action. Keep it ` +
          `grounded in the real specs — written to convert, not to hype. Use tasteful energy; avoid spammy ` +
          `buzzwords and exclamation-point overload.\n\n` +
          (goal ? `The store owner's goal for this campaign: """${goal}"""\n\n` : '') +
          `Compose a complete marketing campaign for the following ${target ? 'product' : 'store'}. ` +
          `Ground every claim in the details provided — do not invent features, prices, or specs.\n\n` +
          `Where a link is appropriate (social CTAs and the email), use this exact page URL verbatim — ` +
          `do not shorten, guess, or alter it: ${link}\n\n` +
          `Details:\n${JSON.stringify(subject, null, 2)}`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!block) throw new Error('Model did not return a campaign')

  const out = block.input as Partial<Campaign>
  // Validate the essentials so a malformed response falls back cleanly.
  if (
    !out.tagline ||
    !Array.isArray(out.tweets) ||
    out.tweets.length === 0 ||
    !out.email?.subject ||
    !out.email?.body ||
    !out.seo?.metaTitle ||
    !out.seo?.metaDescription ||
    !Array.isArray(out.adHeadlines)
  ) {
    throw new Error('Model returned an incomplete campaign')
  }

  return {
    tagline: out.tagline.trim(),
    tweets: out.tweets.slice(0, 3).map((t) => String(t).trim()),
    linkedin: String(out.linkedin ?? '').trim(),
    instagram: String(out.instagram ?? '').trim(),
    email: { subject: out.email.subject.trim(), body: out.email.body.trim() },
    seo: { metaTitle: out.seo.metaTitle.trim(), metaDescription: out.seo.metaDescription.trim() },
    adHeadlines: out.adHeadlines.slice(0, 3).map((h) => String(h).trim()),
    // The link and image are set deterministically so every campaign points at
    // the real page and ships a shareable image, regardless of the model output.
    link,
    image: CAMPAIGN_IMAGE,
  }
}

function normalizeRow(row: any): CampaignRow {
  const assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : row.assets
  // Campaigns generated before links/images were added won't carry them.
  // Backfill so every listed campaign has a real page link and a shareable image.
  if (assets && typeof assets === 'object') {
    if (!assets.link) {
      assets.link = row.sku && row.sku !== STORE_SKU ? `${SITE_URL}/product/${encodeURIComponent(row.sku)}` : SITE_URL
    }
    if (!assets.image) assets.image = CAMPAIGN_IMAGE
  }
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

export default async (req: Request, _context: Context) => {
  // ---- GET: list recent campaigns ----
  if (req.method === 'GET') {
    try {
      const db = getDatabase()
      const rows = (await db.sql`
        SELECT id, sku, product_name, goal, source, assets, created_at
        FROM campaigns
        ORDER BY created_at DESC, id DESC
        LIMIT 12
      `) as any[]
      return Response.json(
        { campaigns: (rows ?? []).map(normalizeRow) },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (err) {
      console.error('marketing-agent GET error:', (err as Error).message)
      return Response.json({ campaigns: [] })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  }

  // ---- POST: generate a campaign ----
  let sku = ''
  let goal = ''
  try {
    const body = await req.json()
    sku = String(body?.sku ?? '').trim().slice(0, 100)
    goal = String(body?.goal ?? '').trim().slice(0, 500)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { products } = await loadCatalog()
  const isStore = !sku || sku === STORE_SKU
  const target = isStore ? null : products.find((p) => p.sku === sku) ?? null

  if (!isStore && !target) {
    return Response.json({ error: 'That product is no longer in the catalog.' }, { status: 404 })
  }

  const productName = target ? target.name : `${STORE_NAME} (whole store)`
  const storedSku = target ? target.sku : STORE_SKU

  let assets: Campaign
  let source: 'ai' | 'heuristic' = 'ai'
  try {
    assets = await aiCampaign(target, goal, products)
  } catch (err) {
    console.error('Marketing agent AI path failed, using template:', (err as Error).message)
    assets = heuristicCampaign(target, goal)
    source = 'heuristic'
  }

  // Persist the campaign so it survives reloads and can be reviewed later.
  let saved: CampaignRow | null = null
  try {
    const db = getDatabase()
    const [row] = (await db.sql`
      INSERT INTO campaigns (sku, product_name, goal, source, assets)
      VALUES (${storedSku}, ${productName}, ${goal}, ${source}, ${JSON.stringify(assets)}::jsonb)
      RETURNING id, sku, product_name, goal, source, assets, created_at
    `) as any[]
    saved = normalizeRow(row)
  } catch (err) {
    console.error('marketing-agent save error:', (err as Error).message)
    // Still return the generated campaign even if persistence failed.
  }

  return Response.json({
    campaign: saved ?? {
      id: 0,
      sku: storedSku,
      productName,
      goal,
      source,
      assets,
      createdAt: null,
    },
    persisted: saved !== null,
  })
}

export const config: Config = {
  path: '/api/marketing-agent',
}
