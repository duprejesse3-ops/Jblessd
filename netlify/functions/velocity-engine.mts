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
//
// Each platform's copy is generated in its OWN Claude call (run in parallel
// via Promise.allSettled) rather than one combined call returning all four
// as one JSON blob. That way a malformed/truncated response for one platform
// (e.g. the youtube_shorts beat-sheet running long) doesn't silently drop
// the other three variants — each platform succeeds or fails independently.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5'
const SITE = 'https://jblessd.com'

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
async function pickSource(db: ReturnType<typeof getDatabase>): Promise <
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

type Platform = 'x' | 'youtube_shorts' | 'reddit' | 'bluesky'

interface Variant {
  platform: Platform
  content: string
}

// Shared brand-voice rules every platform's copy must follow, regardless of
// which platform-specific instructions get appended after this.
const PREAMBLE =
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
  `a sales pitch — the CTA is "go verify this," not "buy now."\n\n`

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  x:
    `Write a single X (Twitter) post: under 280 characters, or the opening post of a thread if it needs ` +
    `more room. Must open with the fact, not a greeting. The URL must appear on its own line at the end, ` +
    `immediately preceded by a short action phrase (e.g. "Full run here:") on the same or preceding line — ` +
    `never buried mid-sentence.\n\n` +
    `Return ONLY valid JSON: {"x": "..."}`,
  youtube_shorts:
    `Write a YouTube Shorts script: a beat-sheet for a 30-45 second vertical video. Format as timestamped ` +
    `beats (0:00-0:02 HOOK, 0:02-0:15 SHOW, etc). The hook (first 1.5s) must be spoken, punchy, and specific ` +
    `— no text-on-screen fluff. Include a final beat (e.g. 0:40-0:45 CTA) with an explicit spoken/on-screen ` +
    `line telling the viewer to go check the page themselves, plus a note to show the actual URL on screen ` +
    `large enough to read, not just a passing mention.\n\n` +
    `Return ONLY valid JSON: {"youtube_shorts": "..."}`,
  reddit:
    `Write a Reddit text post title + body suited to a startup/AI-tools subreddit. Reddit punishes obvious ` +
    `marketing — write it like a genuine "here's something I found/built" post, first person, plain, ` +
    `slightly self-deprecating if the fact is a failure. Still end the body with a clear, low-pressure ` +
    `invitation to click through and verify the fact themselves (e.g. "Full log's here if you want to see ` +
    `the raw output:"), not just an unlabeled link.\n\n` +
    `Return ONLY valid JSON: {"title": "...", "body": "..."}`,
  bluesky:
    `Write a single Bluesky post: under 300 characters. Same rules as an X post — open with the fact, not ` +
    `a greeting. Bluesky's audience skews more toward builders and skeptical-of-hype tech people, so lean ` +
    `plainer and more matter-of-fact, less punchy/viral in tone than an X post would be. The URL must appear ` +
    `on its own line at the end, immediately preceded by a short action phrase.\n\n` +
    `Return ONLY valid JSON: {"bluesky": "..."}`,
}

// youtube_shorts needs more room for a full timestamped beat-sheet; the
// other three are short single posts. 1200 was too tight in practice — a
// full beat-sheet (6-7 beats with spoken lines) plus JSON wrapping and
// escaping regularly ran past it, cutting the response off mid-string and
// producing invalid JSON. Bumped with headroom rather than trimmed exactly
// to the observed failure, since this only runs once/day — the extra token
// budget costs nothing meaningful.
const MAX_TOKENS: Record<Platform, number> = {
  x: 600,
  youtube_shorts: 2500,
  reddit: 700,
  bluesky: 600,
}

async function generatePlatformContent(anthropic: Anthropic, platform: Platform, factSheet: string): Promise<Variant> {
  const system = PREAMBLE + PLATFORM_INSTRUCTIONS[platform]

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS[platform],
    system,
    messages: [{ role: 'user', content: factSheet }],
  })

  const text = res.content.find((b) => b.type === 'text')?.text ?? '{}'
  const cleaned = text.replace(/```json|```/g, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    // Distinguish "the model ran out of tokens mid-response" from "the model
    // returned something that just isn't valid JSON" — the fix for each is
    // different (raise max_tokens vs. tighten the prompt), and stop_reason
    // tells them apart without having to guess from the parse error alone.
    const truncated = res.stop_reason === 'max_tokens'
    console.error(
      `[velocity-engine] ${platform} JSON parse failed (stop_reason=${res.stop_reason}` +
        `${truncated ? `, likely truncated — raise MAX_TOKENS.${platform}` : ''}): ` +
        `${(err as Error).message}. Response length: ${cleaned.length} chars.`
    )
    throw err
  }

  if (platform === 'reddit') {
    const content = `${parsed.title ?? ''}\n\n${parsed.body ?? ''}`.trim()
    if (!content) throw new Error('empty reddit content')
    return { platform, content }
  }

  const content = String(parsed[platform] ?? '').trim()
  if (!content) throw new Error(`empty ${platform} content`)
  return { platform, content }
}

async function generateVariants(factSheet: string): Promise<Variant[]> {
  const anthropic = new Anthropic()
  const platforms: Platform[] = ['x', 'youtube_shorts', 'reddit', 'bluesky']

  const results = await Promise.allSettled(
    platforms.map((p) => generatePlatformContent(anthropic, p, factSheet))
  )

  const variants: Variant[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      variants.push(r.value)
    } else {
      console.error(`[velocity-engine] ${platforms[i]} generation failed:`, (r.reason as Error)?.message ?? r.reason)
    }
  })
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
  const variants = await generateVariants(factSheet)

  if (!variants.length) {
    console.error('[velocity-engine] all platform generations failed')
    return Response.json({ generated: 0, reason: 'all generations failed' }, { status: 500 })
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

  console.log(`[velocity-engine] queued ${inserted}/${variants.length} post(s) from ${sourceType}:${sourceId}`)
  return Response.json({ generated: inserted, attempted: 4, sourceType, sourceId })
}

export const config: Config = {
  // Daily, off-peak — separate from the other scheduled jobs' slots.
  schedule: '0 12 * * *',
}
