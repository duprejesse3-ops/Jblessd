// Scheduled function: MultiNiche Ads network autopilot.
//
// Makes multinicheai.com's own participation in the ad network fully automatic:
// no admin panel, no manual "create a slot" or "create a campaign" step.
// This function IS the self-tenant's admin — it runs first-party against the
// database directly (tenantById, not a bearer key) since it's acting as this
// store's own account, not verifying an external caller.
//
// Two things it keeps in sync, both idempotent (safe to run repeatedly):
//   1. A single, deterministic slot representing ad space ON multinicheai.com
//      itself (SELF_SLOT_KEY below) — offered to the network so other
//      tenants' campaigns can appear on this site once they exist.
//   2. One active campaign per catalog product, running INTO other tenants'
//      slots — regenerated only once stale, same pattern as
//      guides-generator.mts and multiads-scheduler.mts.
//
// Honest limitation worth knowing: with zero other tenants in the network
// yet, neither side does anything visible — the serve endpoint deliberately
// excludes a slot's own tenant's campaigns (no self-serving), so multinicheai.com's
// own slot will show nothing until a second tenant joins with a campaign, and
// multinicheai.com's campaigns won't appear anywhere until a second tenant offers
// a slot. This function is the bootstrap: the inventory is ready and waiting
// the moment a second tenant connects.
//
// Env vars (all optional):
//   ADS_NETWORK_ENABLED     'false' to disable entirely (default: on)
//   ADS_NETWORK_STALE_DAYS  regenerate a product's campaign after this many days (default: 45)
//   ADS_NETWORK_BATCH_SIZE  max campaigns (re)generated per run (default: 4)

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '../lib/db.mjs'
import { tenantById } from '../lib/ads-tenants.mjs'

const ENABLED = process.env.ADS_NETWORK_ENABLED !== 'false'
const STALE_DAYS = Number(process.env.ADS_NETWORK_STALE_DAYS || 45)
const BATCH_SIZE = Number(process.env.ADS_NETWORK_BATCH_SIZE || 4)
const MODEL = 'claude-sonnet-5'
const SELF_TENANT_EMAIL = 'store@multinicheai.com'
const SELF_SLOT_KEY = 'slot_self_jblessd'
const MODEL_MAX_TOKENS = 200

interface Creative {
  headline: string
  body: string
}

function fallbackCreative(productName: string, blurb: string): Creative {
  return { headline: productName.slice(0, 60), body: blurb.slice(0, 140) || `See how ${productName} can help.` }
}

async function aiCreative(productName: string, blurb: string, niche: string): Promise<Creative> {
  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MODEL_MAX_TOKENS,
    system:
      'You write short, honest ad creative for a native ad network (not Google/Meta — a cooperative ' +
      'network between independent online stores). Return ONLY a JSON object: {"headline": string, "body": string}. ' +
      'headline: under 60 characters, no clickbait, no ALL CAPS, no exclamation-mark stacking. ' +
      'body: under 140 characters, one concrete, specific benefit — not generic hype. ' +
      'Ground everything in the product info given. Never invent features, stats, or claims not provided.',
    messages: [
      { role: 'user', content: `Product: ${productName}\nWhat it does: ${blurb}\nBuilt for: ${niche}` },
    ],
  })
  const text = message.content.find((b) => b.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in model response')
  const parsed = JSON.parse(match[0]) as Partial<Creative>
  if (!parsed.headline || !parsed.body) throw new Error('Incomplete creative from model')
  return { headline: String(parsed.headline).slice(0, 60), body: String(parsed.body).slice(0, 140) }
}

async function ensureSelfSlot(tenantId: number): Promise<void> {
  const db = getDatabase()
  await db.sql`
    INSERT INTO ads_network_slots (tenant_id, slot_key, site_url, label, niche)
    VALUES (${tenantId}, ${SELF_SLOT_KEY}, 'https://multinicheai.com', 'Product page sidebar', NULL)
    ON CONFLICT (slot_key) DO NOTHING
  `
}

async function getLastCampaignBySku(tenantId: number): Promise<Map<string, Date | null>> {
  const db = getDatabase()
  // click_url encodes the sku as the last path segment
  // (https://multinicheai.com/product/<SKU>), so it doubles as the campaign's key
  // without needing a separate sku column on a table shared across tenants.
  const rows = (await db.sql`
    SELECT click_url, created_at FROM ads_network_campaigns WHERE tenant_id = ${tenantId}
  `) as any[]
  const map = new Map<string, Date | null>()
  for (const row of rows) {
    const sku = decodeURIComponent(String(row.click_url).split('/').pop() ?? '')
    const existing = map.get(sku)
    const created = row.created_at ? new Date(row.created_at) : null
    if (!existing || (created && (!existing || created > existing))) map.set(sku, created)
  }
  return map
}

function isStale(lastCreated: Date | null | undefined): boolean {
  if (!lastCreated) return true
  const ageDays = (Date.now() - lastCreated.getTime()) / 86_400_000
  return ageDays >= STALE_DAYS
}

export default async () => {
  if (!ENABLED) {
    console.log('[ads-network-autopilot] disabled (ADS_NETWORK_ENABLED=false)')
    return Response.json({ skipped: 'disabled' })
  }

  const db = getDatabase()
  const [tenantRow] = (await db.sql`
    SELECT id FROM ads_tenants WHERE email = ${SELF_TENANT_EMAIL} LIMIT 1
  `) as any[]

  if (!tenantRow) {
    console.error('[ads-network-autopilot] no self-tenant found — has the seed migration run yet?')
    return Response.json({ error: 'self-tenant not seeded' }, { status: 503 })
  }
  const tenant = await tenantById(tenantRow.id)
  if (!tenant) {
    console.error('[ads-network-autopilot] self-tenant row exists but tenantById failed')
    return Response.json({ error: 'self-tenant lookup failed' }, { status: 503 })
  }

  await ensureSelfSlot(tenant.id)

  const { products } = await loadCatalog()
  const lastBySku = await getLastCampaignBySku(tenant.id)
  const due = products.filter((p) => isStale(lastBySku.get(p.sku))).slice(0, BATCH_SIZE)

  if (!due.length) {
    console.log('[ads-network-autopilot] self-slot ensured; no campaigns due')
    return Response.json({ slotEnsured: true, campaignsGenerated: 0 })
  }

  console.log(`[ads-network-autopilot] generating ${due.length} campaign(s): ${due.map((p) => p.sku).join(', ')}`)

  let generated = 0
  for (const p of due) {
    try {
      let creative: Creative
      try {
        creative = await aiCreative(p.name, p.blurb, p.niche)
      } catch (err) {
        console.error(`[ads-network-autopilot] AI creative failed for ${p.sku}, using fallback —`, (err as Error).message)
        creative = fallbackCreative(p.name, p.blurb)
      }
      const clickUrl = `https://multinicheai.com/product/${encodeURIComponent(p.sku)}`
      await db.sql`
        INSERT INTO ads_network_campaigns (tenant_id, headline, body, click_url, niche)
        VALUES (${tenant.id}, ${creative.headline}, ${creative.body}, ${clickUrl}, ${p.niche})
      `
      generated++
    } catch (err) {
      console.error(`[ads-network-autopilot] failed to create campaign for ${p.sku}:`, (err as Error).message)
    }
  }

  return Response.json({ slotEnsured: true, campaignsGenerated: generated, attempted: due.length })
}

export const config: Config = {
  // Weekly — the catalog changes slowly and, with no other tenants yet,
  // there's no traffic reason to run this more often.
  schedule: '@weekly',
}
