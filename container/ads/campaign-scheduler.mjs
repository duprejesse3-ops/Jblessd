// MultiAds campaign scheduler — automates the existing /api/marketing-agent
// so campaigns get generated regularly instead of requiring a manual click in
// /admin. Runs in-process inside the container (wired from server.mjs),
// calling generateCampaign() directly — no HTTP call, so no admin session is
// needed.
//
// Env vars (all optional, sensible defaults):
//   MULTIADS_ENABLED         'false' to disable entirely (default: on)
//   MULTIADS_INTERVAL_HOURS  how often to check for stale/missing campaigns (default: 24)
//   MULTIADS_STALE_DAYS      regenerate a sku's campaign after this many days (default: 30)
//   MULTIADS_BATCH_SIZE      max campaigns generated per run, to bound API spend (default: 3)

import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../../netlify/functions/lib/db.mjs'
import { generateCampaign } from '../../netlify/functions/marketing-agent.mts'
import { submitUrls } from '../../netlify/functions/lib/indexnow.mjs'

const ENABLED = process.env.MULTIADS_ENABLED !== 'false'
const INTERVAL_HOURS = Number(process.env.MULTIADS_INTERVAL_HOURS || 24)
const STALE_DAYS = Number(process.env.MULTIADS_STALE_DAYS || 30)
const BATCH_SIZE = Number(process.env.MULTIADS_BATCH_SIZE || 3)
// Same site URL server.mjs falls back to, so a newly published /updates/:id
// page resolves to a real absolute URL for IndexNow regardless of environment.
const SITE_URL = (process.env.SITE_URL || 'https://jblessd.com').replace(/\/$/, '')

async function getLastCampaignDates() {
  const db = getDatabase()
  const rows = await db.sql`
    SELECT sku, MAX(created_at) AS last_created
    FROM campaigns
    GROUP BY sku
  `
  const map = new Map()
  for (const row of rows) {
    map.set(row.sku, row.last_created ? new Date(row.last_created) : null)
  }
  return map
}

function isStale(lastCreated) {
  if (!lastCreated) return true
  const ageDays = (Date.now() - lastCreated.getTime()) / 86_400_000
  return ageDays >= STALE_DAYS
}

/** One sweep: find skus (plus the whole-store campaign) due for a refresh, generate up to BATCH_SIZE. */
export async function runCampaignSweep() {
  const { products } = await loadCatalog()
  const lastBySku = await getLastCampaignDates()

  // The whole-store campaign is its own row keyed 'STORE' in the campaigns table.
  const targets = [
    { sku: 'STORE', label: 'the whole store' },
    ...products.map((p) => ({ sku: p.sku, label: p.name })),
  ]

  const due = targets.filter((t) => isStale(lastBySku.get(t.sku))).slice(0, BATCH_SIZE)

  if (!due.length) {
    console.log('[multiads] no campaigns due — everything within the staleness window')
    return { generated: 0, attempted: 0 }
  }

  console.log(`[multiads] generating ${due.length} campaign(s): ${due.map((d) => d.label).join(', ')}`)

  let generated = 0
  for (const t of due) {
    try {
      const result = await generateCampaign({ sku: t.sku === 'STORE' ? '' : t.sku, goal: '' })
      console.log(`[multiads] campaign generated for ${t.label} (persisted: ${result.persisted})`)
      if (result.persisted) {
        generated++
        const campaignId = result.campaign?.id
        if (campaignId) {
          const updateUrl = `${SITE_URL}/updates/${campaignId}`
          try {
            const idxResult = await submitUrls([updateUrl])
            console.log(`[multiads] IndexNow submitted ${updateUrl} — HTTP ${idxResult.status}`)
          } catch (err) {
            // Non-fatal: the twice-daily indexnow-submit.mts sweep will pick this
            // URL up from the sitemap regardless, just up to 12h later.
            console.error(`[multiads] IndexNow submission failed for ${updateUrl}:`, err.message)
          }
        }
      }
    } catch (err) {
      console.error(`[multiads] failed to generate campaign for ${t.label}:`, err.message)
    }
  }
  return { generated, attempted: due.length }
}

let intervalHandle = null
let kickoffHandle = null

/** Starts the recurring sweep. Call once at server boot; call .stop() on shutdown. */
export function startCampaignScheduler() {
  if (!ENABLED) {
    console.log('[multiads] scheduler disabled (MULTIADS_ENABLED=false)')
    return { stop: () => {} }
  }

  const intervalMs = INTERVAL_HOURS * 60 * 60 * 1000
  console.log(
    `[multiads] scheduler starting — checking every ${INTERVAL_HOURS}h, ` +
      `regenerating after ${STALE_DAYS}d idle, up to ${BATCH_SIZE} per run`,
  )

  // First sweep runs shortly after boot (not immediately, so the container has
  // time to finish starting up), then on the regular interval after that.
  kickoffHandle = setTimeout(() => {
    runCampaignSweep().catch((err) => console.error('[multiads] sweep failed:', err.message))
  }, 30_000)

  intervalHandle = setInterval(() => {
    runCampaignSweep().catch((err) => console.error('[multiads] sweep failed:', err.message))
  }, intervalMs)

  return {
    stop: () => {
      clearTimeout(kickoffHandle)
      clearInterval(intervalHandle)
    },
  }
}
