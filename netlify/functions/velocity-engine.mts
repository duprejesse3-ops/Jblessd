// Scheduled function: content-velocity engine.
//
// Generates platform-native short-form content from the store's own real,
// verifiable data — Live Proof runs and benchmark scorecard history — instead
// of generic marketing copy. The hook is always something a reader can click
// through and check for themselves (a real run, a real failure, a real fix),
// which is the store's actual structural advantage: no competitor publishes
// failures or timestamps runs publicly.
//
// Runs daily. Each run picks ONE fresh source (the most recent unposted proof
// or the most recently-changed scorecard) and generates one variant per
// platform, queued into velocity_posts for later posting/review.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5'
const SITE = 'https://jblessd.com'
const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
interface ProofRow {
  id: string
  sku: string
  product_name: string
  scenario: string
  output: string
  created_at: string
}
interface ScorecardChangeRow {
  sku: string
  outcome: string
  duration_ms: number | null
  created_at: string
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

// Find the freshest real thing to write about: prefer a scorecard run from
// the last 24h (especially a failure — that's the strongest, least-fakeable
// hook), fall back to the most recent shared proof. Scorecard events are
// joined against products so the content can refer to a readable product
// name instead of an internal SKU.
async function pickSource(db: ReturnType<typeof getDatabase>): Promise<
  | { type: 'scorecard'; sku: string; productName: string; outcome: string; durationMs: number | null; createdAt: string }
  | { type: 'proof'; id: string; sku: string; productName: string; scenario: string; output: string; createdAt: string }
  | null
> {
  const recentRuns = (await db.sql`
    SELECT r.sku, r.outcome, r.duration_ms, r.created_at, p.name AS product_name
    FROM benchmark_runs r
    LEFT JOIN products p ON p.sku = r.sku
    WHERE r.created_at > now() - interval '2 days'
    ORDER BY (r.outcome = 'failed') DESC, r.created_at DESC
    LIMIT 1
  `) as (ScorecardChangeRow & { product_name: string | null })[]
  if (recentRuns.length) {
    const r = recentRuns[0]
    return {
      type: 'scorecard',
      sku: r.sku,
      productName: r.product_name || r.sku,
      outcome: r.outcome,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    }
  }

  const recentProofs = (await db.sql`
    SELECT id, sku, product_name, scenario, output, created_at FROM proofs
    ORDER BY created_at DESC LIMIT 1
  `) as ProofRow[]
  if (recentProofs.length) {
    const p = recentProofs[0]
    return { type: 'proof', id: p.id, sku: p.sku, productName: p.product_name, scenario: p.scenario, output: p.output, createdAt: p.created_at }
  }
  return null
}

function buildFactSheet(source: NonNullable<Awaited<ReturnType<typeof pickSource>>>): string {
  if (source.type === 'scorecard') {
    const url = `${SITE}/scorecard/${encodeURIComponent(source.sku)}`
    return (
      `Real, verifiable event: a benchmark run just completed.\n` +
      `Product name (use this in the post, not the SKU): ${source.productName}\n` +
      `Product SKU (for reference only, don't lead with it): ${source.sku}\n` +
      `Outcome: ${source.outcome}\n` +
      `Duration: ${source.durationMs ? source.durationMs + 'ms' : 'unknown'}\n` +
      `Timestamp: ${source.createdAt}\n` +
      `Public, checkable URL: ${url}\n` +
      (source.outcome === 'failed'
        ? `This was a FAILURE. The methodology publishes failures on purpose — use that as the hook. Do not spin it as a success.`
        : `This was a success on the store's public, dated benchmark.`)
    )
  }
  const url = `${SITE}/proof/${source.id}`
  return (
    `Real, verifiable event: a shopper ran a live product demo and it was saved publicly.\n` +
    `Product: ${source.productName} (${source.sku})\n` +
    `Scenario it ran on: ${source.scenario || '(default demo)'}\n` +
    `Output excerpt: ${source.output.slice(0, 400)}\n` +
    `Timestamp: ${source.createdAt}\n` +
    `Public, checkable URL: ${url}`
  )
}

interface Variant {
  platform: 'x' | 'youtube_shorts' | 'reddit'
  content: string
}

async function generateVariants(factSheet: string): Promise<Variant[]> {
  const anthropic = new Anthropic()

  const system =
    `You write content for MULTINICHE AI, a store whose entire differentiator is publishing REAL, ` +
    `unedited, dated proof of its tools working — including failures. You never write generic marketing ` +
    `copy ("check out our amazing tool"). Every post you write must center on the one verifiable fact ` +
    `given to you, and must include the public URL so a reader can check it themselves. If the fact is a ` +
    `failure, do not spin it — a public failure log is the actual credibility asset here, treat it as one.\n\n` +
    `Always refer to the product by its name (e.g. "Meeting Notes Agent"), never by its raw SKU (e.g. ` +
    `"AI-AG-003") — the SKU is internal, not reader-friendly.\n\n` +
    `Every piece must end with an explicit, visible call-to-action around the URL — not just a bare link ` +
    `dropped in. Readers who engage (like, expand, visit a profile) but never click the link are the failure ` +
    `mode to avoid: a link with no verb next to it gets scrolled past. Pair the URL with a direct action phrase ` +
    `("See the run:", "Check it yourself:", "Full log here:") suited to the fact being shared — never a vague ` +
    `sign-off like "check it out" or "link in bio" with no visible URL. This still has to read as evidence, not ` +
    `a sales pitch — the CTA is "go verify this," not "buy now."\n\n` +
    `Write three DIFFERENT platform-native pieces, not one piece copy-pasted three times:\n\n` +
    `1. X (Twitter): a single post, under 280 characters, or the opening post of a thread if it needs more ` +
    `room. Must open with the fact, not a greeting. The URL must appear on its own line at the end, immediately ` +
    `preceded by a short action phrase (e.g. "Full run here:") on the same or preceding line — never buried ` +
    `mid-sentence.\n\n` +
    `2. YouTube Shorts script: a beat-sheet for a 30-45 second vertical video. Format as timestamped beats ` +
    `(0:00-0:02 HOOK, 0:02-0:15 SHOW, etc). The hook (first 1.5s) must be spoken, punchy, and specific — no ` +
    `text-on-screen fluff. Include a final beat (e.g. 0:40-0:45 CTA) with an explicit spoken/on-screen line ` +
    `telling the viewer to go check the page themselves, plus a note to show the actual URL on screen large ` +
    `enough to read, not just a passing mention.\n\n` +
    `3. Reddit: a text post title + body suited to a startup/AI-tools subreddit. Reddit punishes obvious ` +
    `marketing — write it like a genuine "here's something I found/built" post, first person, plain, ` +
    `slightly self-deprecating if the fact is a failure. Still end the body with a clear, low-pressure ` +
    `invitation to click through and verify the fact themselves (e.g. "Full log's here if you want to see the ` +
    `raw output:"), not just an unlabeled link.\n\n` +
    `Return ONLY valid JSON: {"x": "...", "youtube_shorts": "...", "reddit": {"title": "...", "body": "..."}}`

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: factSheet }],
  })

  const text = res.content.find((b) => b.type === 'text')?.text ?? '{}'
  let parsed: any
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return []
  }

  const variants: Variant[] = []
  if (parsed.x) variants.push({ platform: 'x', content: String(parsed.x) })
  if (parsed.youtube_shorts) variants.push({ platform: 'youtube_shorts', content: String(parsed.youtube_shorts) })
  if (parsed.reddit) {
    variants.push({
      platform: 'reddit',
      content: `${parsed.reddit.title ?? ''}\n\n${parsed.reddit.body ?? ''}`.trim(),
    })
  }
  return variants
}

export default async (_req: Request) => {
  const db = getDatabase()

  const source = await pickSource(db)
  if (!source) {
    console.log('[velocity-engine] no proof or scorecard data yet — nothing to write about')
    return Response.json({ generated: 0, reason: 'no source data' })
  }

  const factSheet = buildFactSheet(source)
  let variants: Variant[] = []
  try {
    variants = await generateVariants(factSheet)
  } catch (err) {
    console.error('[velocity-engine] generation failed:', (err as Error).message)
    return Response.json({ generated: 0, error: 'generation failed' }, { status: 500 })
  }

  if (!variants.length) {
    console.error('[velocity-engine] model returned no usable variants')
    return Response.json({ generated: 0, reason: 'empty generation' })
  }

  const sourceType = source.type
  const sourceId = source.type === 'scorecard' ? source.sku : source.id
  let inserted = 0
  for (const v of variants) {
    try {
      await db.sql`
        INSERT INTO velocity_posts (id, source_type, source_id, platform, content, status)
        VALUES (${shortId()}, ${sourceType}, ${sourceId}, ${v.platform}, ${v.content}, 'queued')
      `
      inserted++
    } catch (err) {
      console.error(`[velocity-engine] failed to queue ${v.platform} post:`, (err as Error).message)
    }
  }

  console.log(`[velocity-engine] queued ${inserted} post(s) from ${sourceType}:${sourceId}`)
  return Response.json({ generated: inserted, sourceType, sourceId })
}

export const config: Config = {
  // Daily, off-peak — separate from the other two scheduled jobs' slots.
  schedule: '0 12 * * *',
}
