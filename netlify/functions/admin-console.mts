// Netlify Function: /api/admin-console
//
// The brain behind the private AI workstation at /admin. It is a Claude agent
// that answers the owner's plain-English questions about the running store and,
// to do so, can call a fixed set of READ-ONLY tools that query the live Netlify
// Database (catalog, campaigns, reviews, subscribers, contact messages, live
// proofs) and the latest automated agent runs (security, site health, crawl).
//
// Hard rules baked in:
//   - Every request must carry a valid admin session cookie (see admin-auth).
//     There is no anonymous access to store operational data.
//   - The tools are strictly read-only. The model cannot mutate anything; the
//     worst it can do is read rows it's already authorized to see.
//   - Anthropic is reached through the Netlify AI Gateway (no key management).
//     If the model or the DB is unavailable the console degrades to a clear
//     message rather than failing opaquely.

import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { loadCatalog } from '../lib/db.mjs'

const MODEL = 'claude-sonnet-4-5'
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
      (SELECT count(*) FROM proofs)            AS proofs
  `) as any[]
  return {
    counts,
    note: 'Counts of every operational table. Use the specific tools for detail.',
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

async function latestRun(table: 'security_runs' | 'site_health_runs' | 'crawl_runs'): Promise<unknown> {
  const db = getDatabase()
  // Tagged-template queries only (matches the rest of the codebase); the table
  // is selected by an internal switch, never interpolated from user input.
  let rows: any[]
  switch (table) {
    case 'security_runs':
      rows = (await db.sql`SELECT status, summary, recommendation, created_at FROM security_runs ORDER BY created_at DESC LIMIT 1`) as any[]
      break
    case 'site_health_runs':
      rows = (await db.sql`SELECT status, summary, recommendation, created_at FROM site_health_runs ORDER BY created_at DESC LIMIT 1`) as any[]
      break
    case 'crawl_runs':
      rows = (await db.sql`SELECT status, summary, recommendation, created_at FROM crawl_runs ORDER BY created_at DESC LIMIT 1`) as any[]
      break
  }
  return rows[0] ?? { note: `No ${table} recorded yet.` }
}

type ToolRunner = (input: any) => Promise<unknown>

const TOOL_RUNNERS: Record<string, ToolRunner> = {
  store_overview: () => storeOverview(),
  list_products: () => listProducts(),
  recent_campaigns: (i) => recentCampaigns(Math.min(Math.max(Number(i?.limit) || 8, 1), 25)),
  reviews_summary: () => reviewsSummary(),
  subscribers_summary: () => subscribersSummary(),
  contact_messages: (i) => contactMessages(Math.min(Math.max(Number(i?.limit) || 10, 1), 25)),
  recent_proofs: (i) => recentProofs(Math.min(Math.max(Number(i?.limit) || 10, 1), 25)),
  security_status: () => latestRun('security_runs'),
  site_health: () => latestRun('site_health_runs'),
  crawl_status: () => latestRun('crawl_runs'),
}

const TOOLS: Anthropic.Tool[] = [
  { name: 'store_overview', description: 'Row counts across every operational table. Good first call for "how is the store doing".', input_schema: { type: 'object', properties: {} } },
  { name: 'list_products', description: 'The full live product catalog: SKU, name, category, audience niche, and price.', input_schema: { type: 'object', properties: {} } },
  { name: 'recent_campaigns', description: 'Recently generated marketing campaigns (metadata only).', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 8' } } } },
  { name: 'reviews_summary', description: 'Total review count, average rating, and the most recent reviews.', input_schema: { type: 'object', properties: {} } },
  { name: 'subscribers_summary', description: 'Email subscriber totals, breakdown by source, and recent sign-ups.', input_schema: { type: 'object', properties: {} } },
  { name: 'contact_messages', description: 'Recent contact-form messages (excerpts).', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 10' } } } },
  { name: 'recent_proofs', description: 'Recent shared "Live Proof" runs shoppers saved.', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: '1-25, default 10' } } } },
  { name: 'security_status', description: 'The latest automated security-header scan result.', input_schema: { type: 'object', properties: {} } },
  { name: 'site_health', description: 'The latest automated site-health check result.', input_schema: { type: 'object', properties: {} } },
  { name: 'crawl_status', description: 'The latest automated discovery-crawl result.', input_schema: { type: 'object', properties: {} } },
]

const SYSTEM_PROMPT =
  `You are the operations console for ${STORE_NAME}, a store of ready-to-use AI productivity tools. ` +
  `You are speaking privately to the store owner inside a terminal-style admin workstation — be direct, ` +
  `concise, and technical, like a good CLI. Prefer short lines and compact tables over long prose.\n\n` +
  `You have read-only tools that query the live store. When the owner asks about the state of the store ` +
  `(sales signals, subscribers, reviews, messages, security, health, catalog), CALL THE RELEVANT TOOL and ` +
  `answer from the real data — never guess or invent numbers. If a tool reports the data store is ` +
  `unavailable, say so plainly. You cannot change anything; if asked to modify data, explain that this ` +
  `console is read-only and describe what you would do instead. Today's context is a live production store.`

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
        max_tokens: 1400,
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
      for (const use of toolUses) {
        toolsUsed.push(use.name)
        const runner = TOOL_RUNNERS[use.name]
        let payload: string
        try {
          if (!runner) throw new Error(`Unknown tool ${use.name}`)
          payload = JSON.stringify(await runner(use.input))
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
