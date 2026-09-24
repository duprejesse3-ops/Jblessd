// Netlify Function: /api/admin-console
//
// The brain behind the private AI workstation at /admin. It is a Claude agent
// that answers the owner's plain-English questions about the running store and,
// to do so, can call a fixed set of READ-ONLY tools that query the live Netlify
// Database (catalog, campaigns, reviews, subscribers, contact messages, live
// proofs), the latest automated agent runs (site health — both stored history
// and a live on-demand check, crawl), scorecard coverage gaps, the ad network's
// spend/budget health, and the social-post generation pipeline's status.
//
// It can also take a small, fixed set of real ACTIONS — currently: re-running
// one product's benchmark scorecard on demand, and clearing one product's
// cached Live Proof demo. Both are the same operations already exposed as
// their own bookmarkable admin endpoints (admin-run-scorecard,
// admin-clear-demo-cache); the console just gives them a conversational front
// door instead of needing the exact URL. This is a DELIBERATELY SHORT,
// NAMED list — the model has no raw SQL, no arbitrary code execution, and no
// way to invent a new action. Adding a new action means adding a new named
// tool here, reviewed like any other code change, never letting the model
// decide what "action" means.
//
// Every action tool follows a propose-then-confirm contract: the model's
// FIRST call for a given action always omits confirm (or sends confirm:
// false), which runs nothing and returns a description of exactly what
// would happen. The SYSTEM_PROMPT requires the model to show that
// description to the owner and get an explicit go-ahead in their next
// message before calling the same tool again with confirm: true, which is
// the only way anything actually executes. This is enforced in the tool
// runner itself, not just requested in the prompt — a runner ignores
// confirm unless it is literally `true`, so a model that mis-reads or
// skips the instruction still can't cause the action to fire.
//
// Hard rules baked in:
//   - Every request must carry a valid admin session cookie (see admin-auth).
//     There is no anonymous access to store operational data.
//   - Every tool — read or action — is drawn from a fixed, named list. The
//     model cannot query or mutate anything outside of it.
//   - Both actions are low-stakes and reversible by nature (re-running a
//     benchmark, clearing a cache entry) — nothing here moves money, deletes
//     a customer-facing record, or is irreversible. That scope is
//     deliberate: this is not a general-purpose "let the agent operate the
//     store" surface.
//   - Anthropic is reached through the Netlify AI Gateway (no key management).
//     If the model or the DB is unavailable the console degrades to a clear
//     message rather than failing opaquely.

import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { getStore } from '@netlify/blobs'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { loadCatalog } from '../lib/db.mjs'
import { getAdPerformance } from '../lib/ad-performance.mjs'
import { runOne, type ScenarioRow } from './scorecard-runner-background.mts'
import { inspectSite } from '../lib/site-health.mjs'

const MODEL = 'claude-sonnet-5'
const STORE_NAME = 'MULTINICHE AI'
const MAX_TURNS = 6 // safety bound on the tool-use loop
const NO_STORE = { 'Cache-Control': 'no-store' }

// ---- read-only tool implementations -------------------------------------

async function storeOverview(): Promise<unknown> {
  const db = getDatabase()
  const [counts] = (await db.sql`
    SELECT
      (SELECT count(*) FROM products)          AS products,
      (SELECT count(*) FROM campaigns)         AS campaigns,
      (SELECT count(*) FROM reviews)           AS reviews,
      (SELECT count(*) FROM subscribers)       AS subscribers,
      (SELECT count(*) FROM contact_messages)  AS contact_messages,
      (SELECT count(*) FROM proofs)            AS proofs,
      (SELECT count(*) FROM credit_accounts)   AS credit_accounts,
      (SELECT count(*) FROM agent_runs)        AS agent_runs
  `) as any[]
  return {
    counts,
    note: 'Counts of every operational table. Use the specific tools for detail — credits_overview for the credit business.',
  }
}

async function listProducts(): Promise<unknown> {
  const { products, source } = await loadCatalog()
  return {
    source,
    count: products.length,
    products: products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      niche: p.niche,
      price: p.price,
    })),
  }
}

async function recentCampaigns(limit: number): Promise<unknown> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, sku, product_name, goal, source, created_at
    FROM campaigns ORDER BY created_at DESC, id DESC LIMIT ${limit}
  `) as any[]
  return { campaigns: rows }
}

async function reviewsSummary(): Promise<unknown> {
  const db = getDatabase()
  const [agg] = (await db.sql`
    SELECT count(*)::int AS total, round(avg(rating)::numeric, 2) AS avg_rating
    FROM reviews
  `) as any[]
  const recent = (await db.sql`
    SELECT sku, author, rating, left(body, 160) AS excerpt, created_at
    FROM reviews ORDER BY created_at DESC LIMIT 8
  `) as any[]
  return { total: agg?.total ?? 0, avgRating: agg?.avg_rating ?? null, recent }
}

async function subscribersSummary(): Promise<unknown> {
  const db = getDatabase()
  const [agg] = (await db.sql`SELECT count(*)::int AS total FROM subscribers`) as any[]
  const bySource = (await db.sql`
    SELECT source, count(*)::int AS n FROM subscribers GROUP BY source ORDER BY n DESC
  `) as any[]
  const recent = (await db.sql`
    SELECT email, source, request_count, created_at FROM subscribers
    ORDER BY created_at DESC LIMIT 10
  `) as any[]
  return { total: agg?.total ?? 0, bySource, recent }
}

async function contactMessages(limit: number): Promise<unknown> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, name, email, subject, left(message, 240) AS excerpt, source, created_at
    FROM contact_messages ORDER BY created_at DESC LIMIT ${limit}
  `) as any[]
  return { messages: rows }
}

async function recentProofs(limit: number): Promise<unknown> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, sku, product_name, left(scenario, 120) AS scenario, created_at
    FROM proofs ORDER BY created_at DESC LIMIT ${limit}
  `) as any[]
  return { proofs: rows }
}

async function recentProductDrafts(limit: number): Promise<unknown> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT sku, name, category, niche, price, format, left(blurb, 160) AS blurb, source, created_at
    FROM product_drafts ORDER BY created_at DESC, id DESC LIMIT ${limit}
  `) as any[]
  return {
    drafts: rows,
    note: 'Product ideas designed by the Product Builder agent. These are drafts only — not in the live catalog until promoted.',
  }
}

// Claude Agent Studio economics: what the credit business is actually doing.
// Credits are prepaid, so revenue and consumption are different clocks — a credit
// sold this month may be spent next month. This reports both sides plus the
// outstanding balance, which is the liability still owed as compute.
async function creditsOverview(days: number): Promise<unknown> {
  const db = getDatabase()

  const [sales] = (await db.sql`
    SELECT
      count(*)::int                              AS purchases,
      coalesce(sum(delta), 0)::int               AS credits_sold,
      coalesce(sum(amount_cents), 0)::int        AS revenue_cents
    FROM credit_ledger
    WHERE reason = 'purchase' AND created_at >= now() - make_interval(days => ${days})
  `) as any[]

  const [spend] = (await db.sql`
    SELECT
      coalesce(-(sum(delta) FILTER (WHERE reason = 'agent_run')), 0)::int AS credits_spent,
      coalesce(sum(delta) FILTER (WHERE reason = 'refund'), 0)::int       AS credits_refunded
    FROM credit_ledger
    WHERE created_at >= now() - make_interval(days => ${days})
  `) as any[]

  const [book] = (await db.sql`
    SELECT
      count(*)::int                                   AS accounts,
      coalesce(sum(balance), 0)::int                   AS credits_outstanding,
      coalesce(sum(lifetime_credits), 0)::int          AS credits_sold_all_time,
      coalesce(sum(lifetime_spend_cents), 0)::int      AS revenue_cents_all_time,
      (count(*) FILTER (WHERE balance > 0))::int       AS accounts_with_balance
    FROM credit_accounts
  `) as any[]

  const byMode = (await db.sql`
    SELECT
      mode,
      count(*)::int                          AS runs,
      (count(*) FILTER (WHERE account_id IS NULL))::int AS trial_runs,
      coalesce(sum(credits), 0)::int         AS credits,
      coalesce(sum(input_tokens), 0)::int    AS input_tokens,
      coalesce(sum(output_tokens), 0)::int   AS output_tokens
    FROM agent_runs
    WHERE created_at >= now() - make_interval(days => ${days})
    GROUP BY mode ORDER BY runs DESC
  `) as any[]

  const topAccounts = (await db.sql`
    SELECT email, balance, lifetime_credits, lifetime_spend_cents, created_at, last_seen_at
    FROM credit_accounts ORDER BY lifetime_spend_cents DESC, id DESC LIMIT 10
  `) as any[]

  const revenue = (sales?.revenue_cents ?? 0) / 100
  const creditsSold = sales?.credits_sold ?? 0

  return {
    windowDays: days,
    window: {
      purchases: sales?.purchases ?? 0,
      creditsSold,
      revenue,
      revenuePerCredit: creditsSold ? Number((revenue / creditsSold).toFixed(4)) : null,
      creditsSpent: spend?.credits_spent ?? 0,
      creditsRefunded: spend?.credits_refunded ?? 0,
    },
    allTime: {
      accounts: book?.accounts ?? 0,
      accountsWithBalance: book?.accounts_with_balance ?? 0,
      creditsOutstanding: book?.credits_outstanding ?? 0,
      creditsSold: book?.credits_sold_all_time ?? 0,
      revenue: (book?.revenue_cents_all_time ?? 0) / 100,
    },
    runsByMode: byMode,
    topAccounts,
    note:
      'Credit revenue is recognised on purchase but consumed later — creditsOutstanding is the balance customers ' +
      'have paid for and not yet spent (deferred compute liability). runsByMode token totals are the cost side: ' +
      'compare them against revenuePerCredit to judge margin per tier. trial_runs are free runs by visitors with no account.',
  }
}

async function latestRun(table: 'site_health_runs' | 'crawl_runs'): Promise<unknown> {
  const db = getDatabase()
  // Tagged-template queries only (matches the rest of the codebase); the table
  // is selected by an internal switch, never interpolated from user input.
  let rows: any[]
  switch (table) {
    case 'site_health_runs':
      rows = (await db.sql`SELECT status, summary, recommendation, created_at FROM site_health_runs ORDER BY created_at DESC LIMIT 1`) as any[]
      break
    case 'crawl_runs':
      rows = (await db.sql`SELECT status, summary, recommendation, created_at FROM crawl_runs ORDER BY created_at DESC LIMIT 1`) as any[]
      break
  }
  return rows[0] ?? { note: `No ${table} recorded yet.` }
}

// Fuller companion to site_health above: pulls the per-check breakdown
// (checks jsonb — what specifically passed/failed, not just the rolled-up
// summary) from the LAST STORED hourly run, plus how many of the last 24
// runs were unhealthy, so "is this a one-off blip or a real trend" has an
// actual answer instead of one data point.
async function siteHealthDetail(): Promise<unknown> {
  const db = getDatabase()
  const [latest] = (await db.sql`
    SELECT status, summary, recommendation, checks, duration_ms, created_at
    FROM site_health_runs ORDER BY created_at DESC LIMIT 1
  `) as any[]
  if (!latest) return { note: 'No site_health_runs recorded yet.' }

  const [trend] = (await db.sql`
    SELECT count(*) FILTER (WHERE status = 'unhealthy') AS unhealthy,
           count(*) FILTER (WHERE status = 'degraded')  AS degraded,
           count(*) AS total
    FROM site_health_runs WHERE created_at > now() - interval '24 hours'
  `) as any[]

  return {
    latest: { status: latest.status, summary: latest.summary, recommendation: latest.recommendation, durationMs: latest.duration_ms, checkedAt: latest.created_at },
    checks: latest.checks, // per-check name/status/detail array — this is what makes it "detail" vs. site_health
    last24h: trend,
  }
}

// Runs the SAME probes as the hourly site-health-agent, live, right now —
// but read-only in the sense that matters here: no row written to
// site_health_runs, no email alert sent, no LLM diagnosis call. Pure
// "what does the owner see if they curl it right now" — the scheduled job
// already owns building the historical trend and paging on real failures,
// this is just a faster way to check between runs. No confirmation needed
// because nothing here has a side effect.
async function siteHealthCheckNow(ctx: ActionCtx): Promise<unknown> {
  const report = await inspectSite(ctx.origin)
  return { status: report.status, summary: report.summary, checks: report.checks, note: 'Live check, not persisted — see site_health_detail for the stored/alerted history.' }
}

// Any SKU with a live catalog entry but no active benchmark scenario is
// exactly the failure mode the Sep 22 repair migration existed to fix
// (scenario-generator.mts's non-atomic write could leave one behind again
// if that ever regresses) — its /scorecard/:sku page 404s with nothing
// automated to catch it. This is that check, on demand.
async function scorecardGaps(): Promise<unknown> {
  const db = getDatabase()
  const { products } = await loadCatalog()
  const rows = (await db.sql`SELECT DISTINCT sku FROM benchmark_scenarios WHERE active = true`) as { sku: string }[]
  const withActive = new Set(rows.map((r) => r.sku))
  const gaps = products.filter((p) => !withActive.has(p.sku)).map((p) => p.sku)
  return {
    totalProducts: products.length,
    productsWithActiveScenario: withActive.size,
    gaps,
    note: gaps.length
      ? `${gaps.length} product(s) have no active benchmark scenario — their /scorecard page 404s. run_scorecard can't fix this by itself (it needs a scenario to run); this needs the repair migration pattern or scenario-generator to seed one.`
      : 'Every live product has an active scenario — no gaps right now.',
  }
}

// Ad network health: spend vs. budget and status per campaign, plus click
// volume over the window — the thing the Sep 22 billing-race fix
// (ads-network-click.mts) made trustworthy to actually read.
async function adsNetworkOverview(days: number): Promise<unknown> {
  const db = getDatabase()
  const campaigns = (await db.sql`
    SELECT id, headline, status, price_cpc_cents, budget_cents, spent_cents, clicks, impressions, created_at
    FROM ads_network_campaigns ORDER BY spent_cents DESC LIMIT 20
  `) as any[]
  const [totals] = (await db.sql`
    SELECT
      count(*) FILTER (WHERE status = 'active') AS active_campaigns,
      count(*) FILTER (WHERE status = 'paused') AS paused_campaigns,
      count(*) FILTER (WHERE budget_cents > 0 AND spent_cents >= budget_cents) AS exhausted_campaigns,
      COALESCE(sum(spent_cents), 0) AS total_spent_cents
    FROM ads_network_campaigns
  `) as any[]
  const [recentClicks] = (await db.sql`
    SELECT count(*) AS clicks FROM ads_network_events
    WHERE type = 'click' AND created_at > now() - make_interval(days => ${days}::int)
  `) as any[]
  return {
    windowDays: days,
    totals: { ...totals, totalSpent: (totals?.total_spent_cents ?? 0) / 100, recentClicks: recentClicks?.clicks ?? 0 },
    topCampaignsBySpend: campaigns.map((c) => ({
      id: c.id,
      headline: c.headline,
      status: c.status,
      priceCpc: c.price_cpc_cents / 100,
      budget: c.budget_cents / 100,
      spent: c.spent_cents / 100,
      clicks: c.clicks,
      impressions: c.impressions,
    })),
  }
}

// Social-post pipeline (velocity-engine.mts) status — queued/posted/failed
// per platform, recent window. Directly answers "did the reddit/x/bluesky
// fix from Sep 22 actually take" without needing to open Netlify's function
// log by hand.
async function velocityPostsStatus(days: number): Promise<unknown> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT platform, status, count(*) AS n
    FROM velocity_posts
    WHERE created_at > now() - make_interval(days => ${days}::int)
    GROUP BY platform, status
    ORDER BY platform, status
  `) as any[]
  const recentFailed = (await db.sql`
    SELECT platform, source_type, source_id, created_at
    FROM velocity_posts
    WHERE status = 'failed' AND created_at > now() - make_interval(days => ${days}::int)
    ORDER BY created_at DESC LIMIT 10
  `) as any[]
  return { windowDays: days, byPlatformAndStatus: rows, recentFailures: recentFailed }
}

type ActionCtx = { origin: string }

// Shared "describe, don't act, until confirmed" shape both action tools use.
// Kept as one small helper so the confirm gate is enforced in exactly one
// place rather than re-implemented (and potentially mis-implemented) per
// action.
function describeOnly(preview: Record<string, unknown>): unknown {
  return { pending: true, ...preview, note: 'Not run yet — describe this to the owner and call again with confirm: true only after they explicitly agree.' }
}

// Action: re-run one product's benchmark scenario now, via the exact same
// logic the weekly scorecard-runner-background.mts sweep uses (same
// success/failure recording rules) — see admin-run-scorecard.mts, which
// this mirrors as a conversational entry point to the same operation.
async function actionRunScorecard(input: any, ctx: ActionCtx): Promise<unknown> {
  const sku = typeof input?.sku === 'string' ? input.sku.trim() : ''
  if (!sku) return { error: 'Missing required field: sku' }

  const db = getDatabase()
  const [scenario] = (await db.sql`
    SELECT id, sku, prompt FROM benchmark_scenarios WHERE sku = ${sku} AND active = true
  `) as ScenarioRow[]
  if (!scenario) {
    return { error: `${sku} has no active benchmark scenario — nothing to run. If this SKU should have one, mention scorecard-diag.` }
  }

  if (input?.confirm !== true) {
    return describeOnly({
      action: 'run_scorecard',
      sku,
      willDo: `Re-run ${sku}'s fixed benchmark scenario right now (a real ~15-25s call, same as the weekly automated run) and record a fresh success-or-failure entry on its public scorecard at /scorecard/${sku}.`,
    })
  }

  const { products } = await loadCatalog()
  const productExists = products.some((p) => p.sku === sku)
  const before = Date.now()
  await runOne(db, ctx.origin, scenario, productExists)
  const durationMs = Date.now() - before

  const [latest] = (await db.sql`
    SELECT outcome, duration_ms FROM benchmark_runs
    WHERE scenario_id = ${scenario.id} ORDER BY created_at DESC LIMIT 1
  `) as { outcome: string; duration_ms: number }[]

  if (!latest) {
    return { ran: true, recorded: false, sku, durationMs, note: 'Looked like infra pressure rather than a real attempt (too fast) — not recorded. Suggest trying again shortly.' }
  }
  return { ran: true, recorded: true, sku, outcome: latest.outcome, durationMs: latest.duration_ms, scorecardUrl: `/scorecard/${sku}` }
}

// Action: clear one product's cached "Live Proof" demo — mirrors
// admin-clear-demo-cache.mts exactly (same store, same cache key shape).
// CACHE_VERSION duplicated deliberately, same as that file already notes
// for its own copy: it must match demo.mts's own constant.
const DEMO_CACHE_VERSION = 'v1'
async function actionClearDemoCache(input: any): Promise<unknown> {
  const sku = typeof input?.sku === 'string' ? input.sku.trim() : ''
  if (!sku) return { error: 'Missing required field: sku' }

  if (input?.confirm !== true) {
    return describeOnly({
      action: 'clear_demo_cache',
      sku,
      willDo: `Clear ${sku}'s cached Live Proof demo, so the next shopper who views its product page triggers a fresh generation instead of a possibly-stale cached one.`,
    })
  }

  const cacheKey = `${DEMO_CACHE_VERSION}/${sku}`
  const store = getStore('product-demos')
  const existed = (await store.get(cacheKey, { type: 'text' })) !== null
  await store.delete(cacheKey)
  return {
    cleared: true,
    sku,
    hadCachedDemo: existed,
    note: existed ? 'Next view regenerates it fresh.' : 'Nothing was cached — this was a no-op, which is fine.',
  }
}

type ToolRunner = (input: any, ctx: ActionCtx) => Promise<unknown>

const TOOL_RUNNERS: Record<string, ToolRunner> = {
  store_overview: () => storeOverview(),
  list_products: () => listProducts(),
  recent_campaigns: (i) => recentCampaigns(Math.min(Math.max(Number(i?.limit) || 8, 1), 25)),
  reviews_summary: () => reviewsSummary(),
  subscribers_summary: () => subscribersSummary(),
  contact_messages: (i) => contactMessages(Math.min(Math.max(Number(i?.limit) || 10, 1), 25)),
  recent_proofs: (i) => recentProofs(Math.min(Math.max(Number(i?.limit) || 10, 1), 25)),
  recent_product_drafts: (i) => recentProductDrafts(Math.min(Math.max(Number(i?.limit) || 10, 1), 25)),
  ad_performance: (i) => getAdPerformance(Number(i?.days) || 30),
  credits_overview: (i) => creditsOverview(Math.min(Math.max(Number(i?.days) || 30, 1), 365)),
  site_health: () => latestRun('site_health_runs'),
  crawl_status: () => latestRun('crawl_runs'),
  site_health_detail: () => siteHealthDetail(),
  site_health_check_now: (_i, ctx) => siteHealthCheckNow(ctx),
  scorecard_gaps: () => scorecardGaps(),
  ads_network_overview: (i) => adsNetworkOverview(Math.min(Math.max(Number(i?.days) || 30, 1), 365)),
  velocity_posts_status: (i) => velocityPostsStatus(Math.min(Math.max(Number(i?.days) || 7, 1), 90)),
  run_scorecard: (i, ctx) => actionRunScorecard(i, ctx),
  clear_demo_cache: (i) => actionClearDemoCache(i),
}

const TOOLS: Anthropic.Tool[] = [
  { name: 'store_overview', description: 'Row counts across every operational table. Good first call for "how is the store doing".', input_schema: { type: 'object', properties: {} } },
  { name: 'list_products', description: 'The full live product catalog: SKU, name, category, audience niche, and price.', input_schema: { type: 'object', properties: {} } },
  { name: 'recent_campaigns', description: 'Recently generated marketing campaigns (metadata only).', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 8' } } } },
  { name: 'reviews_summary', description: 'Total review count, average rating, and the most recent reviews.', input_schema: { type: 'object', properties: {} } },
  { name: 'subscribers_summary', description: 'Email subscriber totals, breakdown by source, and recent sign-ups.', input_schema: { type: 'object', properties: {} } },
  { name: 'contact_messages', description: 'Recent contact-form messages (excerpts).', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 10' } } } },
  { name: 'recent_proofs', description: 'Recent shared "Live Proof" runs shoppers saved.', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 10' } } } },
  { name: 'recent_product_drafts', description: 'Product ideas the Product Builder agent has designed (SKU, name, category, niche, price). Drafts only — not yet in the live catalog. Use for "what has the builder proposed", "any new product ideas".', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 10' } } } },
  { name: 'ad_performance', description: 'First-party Google Ads performance from the store\'s own data: ad traffic (landings), conversions, revenue, conversion rate and average order value, broken down by campaign, source, and landing page. Use for "how are my ads doing", "which campaign converts best", "where should I spend more".', input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Look-back window in days, 1-365 (default 30).' } } } },
  { name: 'credits_overview', description: 'Claude Agent Studio credit economics: purchases, revenue, credits sold vs credits spent, refunds, credits still outstanding (prepaid but unspent), runs and token usage per tier, and the biggest credit customers. Use for "how are credits selling", "how much agent revenue", "what is my margin on deep runs", "how much unspent balance do customers hold".', input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Look-back window in days, 1-365 (default 30).' } } } },
  { name: 'site_health', description: 'The latest automated site-health check result (rolled-up status/summary only).', input_schema: { type: 'object', properties: {} } },
  { name: 'crawl_status', description: 'The latest automated discovery-crawl result.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'site_health_detail',
    description:
      'Fuller than site_health: the last stored hourly check\'s full per-check breakdown (homepage, catalog, reviews, a live scorecard page, ' +
      'Agent Studio, the ads app, the ad-click endpoint, sitemap — whichever individually passed or failed and why), plus how many of the ' +
      'last 24 hourly runs were unhealthy or degraded. Use when the owner asks WHY health is bad, not just what the status is.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'site_health_check_now',
    description:
      'Runs the same checks as the hourly automated sweep LIVE, right now, instead of reading the last stored run — useful right after a ' +
      'deploy or a fix, to confirm something works before waiting for the next scheduled check. Nothing is written to history and no alert ' +
      'is sent; this is purely a live look. No confirmation needed — it has no side effects.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'scorecard_gaps',
    description:
      'Lists any live product with NO active benchmark scenario right now — the exact failure mode that made /scorecard/:sku pages 404 ' +
      'before the Sep 22 repair. Use for "are any scorecards broken" or "is everything scored".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ads_network_overview',
    description:
      'MultiNicheADS campaign health: active/paused/exhausted counts, total spend, top campaigns by spend with budget/spent/clicks, and ' +
      'recent click volume. Use for "how are ad campaigns doing", "which campaign is close to exhausting its budget".',
    input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Look-back window for click volume, 1-365 (default 30).' } } },
  },
  {
    name: 'velocity_posts_status',
    description:
      'Social-post generation pipeline (X, Reddit, Bluesky, YouTube Shorts): counts by platform and status (queued/posted/failed) over a ' +
      'window, plus the most recent failures. Use for "did the posts go out", "is reddit/x/bluesky still failing".',
    input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Look-back window in days, 1-90 (default 7).' } } },
  },
  {
    name: 'run_scorecard',
    description:
      'ACTION (needs confirmation). Re-runs one product\'s benchmark scenario right now instead of waiting for the weekly automated run, ' +
      'and records a fresh success-or-failure entry on its public /scorecard/:sku page. Call WITHOUT confirm first to get a description of ' +
      'what this will do; only call again WITH confirm: true after the owner explicitly agrees.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'The product SKU, e.g. AI-PP-032.' },
        confirm: { type: 'boolean', description: 'Must be true to actually run it. Omit or false to preview first.' },
      },
      required: ['sku'],
    },
  },
  {
    name: 'clear_demo_cache',
    description:
      'ACTION (needs confirmation). Clears one product\'s cached Live Proof demo so the next shopper gets a freshly-generated run. ' +
      'Same propose-then-confirm contract as run_scorecard: call without confirm first to preview, then again with confirm: true to act.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'The product SKU, e.g. AI-PP-032.' },
        confirm: { type: 'boolean', description: 'Must be true to actually clear it. Omit or false to preview first.' },
      },
      required: ['sku'],
    },
  },
]

const SYSTEM_PROMPT =
  `You are the operations console for ${STORE_NAME}, a store of ready-to-use AI productivity tools. ` +
  `You are speaking privately to the store owner inside a terminal-style admin workstation — be direct, ` +
  `concise, and technical, like a good CLI. Prefer short lines and compact tables over long prose.\n\n` +
  `You have read-only tools that query the live store. When the owner asks about the state of the store ` +
  `(sales signals, subscribers, reviews, messages, health, catalog), CALL THE RELEVANT TOOL and ` +
  `answer from the real data — never guess or invent numbers. If a tool reports the data store is ` +
  `unavailable, say so plainly. If the owner wants to CREATE a new product, ` +
  `tell them to run the "build" command (the Product Builder agent) — e.g. build a $20 automation for video editors. ` +
  `The store has two revenue lines: one-off digital products, and the Claude Agent Studio at /agent where customers ` +
  `buy prepaid credits and spend them on agent runs. Use credits_overview for anything about that second line — ` +
  `credit sales, unspent balances, run volume, or per-tier margin. For site reliability, scorecard coverage, the ad ` +
  `network, or the social-post pipeline, use site_health_detail / site_health_check_now / scorecard_gaps / ` +
  `ads_network_overview / velocity_posts_status rather than guessing from memory of past conversations.\n\n` +
  `You also have exactly two ACTION tools: run_scorecard and clear_demo_cache. Both are real, live operations — ` +
  `use them ONLY when the owner clearly asks for that specific action (e.g. "re-run the scorecard for AI-PP-032", ` +
  `"clear the demo cache for AI-CN-008"), never speculatively and never as a side effect of answering an unrelated ` +
  `question. Both follow a strict propose-then-confirm contract: call the tool WITHOUT confirm first, show the ` +
  `owner exactly what it returns as "willDo" in your own words, and wait for their next message to explicitly agree ` +
  `before calling the SAME tool again with confirm: true. Never set confirm: true on a first call, even if the ` +
  `owner's request sounds urgent or certain — the confirmation has to come from them, in the conversation, every time. ` +
  `You have no other way to change anything — no database writes, no other mutations, nothing outside these two named ` +
  `actions. If asked to do anything else that would modify data, explain plainly that this console can't do that and, ` +
  `if there's a relevant read-only tool or one of the two actions instead, offer that. ` +
  `Today's context is a live production store.`

// ---- HTTP handler ---------------------------------------------------------

interface InboundMessage {
  role: 'user' | 'assistant'
  content: string
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }
  if (!isConfigured()) {
    return Response.json({ error: 'Admin console is not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
  }
  if (!isAuthed(req, Date.now())) {
    return Response.json({ error: 'Not authorized. Sign in first.' }, { status: 401, headers: NO_STORE })
  }

  let history: InboundMessage[] = []
  try {
    const body = await req.json()
    const raw = Array.isArray(body?.messages) ? body.messages : []
    history = raw
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-16) // cap conversation length
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 6000) }))
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return Response.json({ error: 'Expected a conversation ending in a user message.' }, { status: 400, headers: NO_STORE })
  }

  const anthropic = new Anthropic()
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }))
  const toolsUsed: string[] = []

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      })

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        return Response.json(
          { reply: text || '(no output)', toolsUsed },
          { headers: NO_STORE },
        )
      }

      // Execute each requested tool and feed results back to the model.
      messages.push({ role: 'assistant', content: response.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      const ctx: ActionCtx = { origin: new URL(req.url).origin }
      for (const use of toolUses) {
        toolsUsed.push(use.name)
        const runner = TOOL_RUNNERS[use.name]
        let payload: string
        try {
          if (!runner) throw new Error(`Unknown tool ${use.name}`)
          payload = JSON.stringify(await runner(use.input, ctx))
        } catch (err) {
          payload = JSON.stringify({
            error: 'Data store unavailable or query failed.',
            detail: (err as Error).message,
          })
        }
        results.push({ type: 'tool_result', tool_use_id: use.id, content: payload })
      }
      messages.push({ role: 'user', content: results })
    }

    return Response.json(
      { reply: 'Stopped after reaching the tool-call limit. Try narrowing the question.', toolsUsed },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('admin-console error:', (err as Error).message)
    return Response.json(
      { error: 'The AI workstation is temporarily unavailable. Check AI Gateway is active (needs a production deploy) and try again.' },
      { status: 502, headers: NO_STORE },
    )
  }
}

export const config: Config = {
  path: '/api/admin-console',
}
