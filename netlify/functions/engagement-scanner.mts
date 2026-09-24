// Scheduled function: engagement scanner / boost loop.
//
// Right now every velocity_posts entry is one-shot: posted once, never
// revisited. This closes that loop — it checks back on posts 20-48h after
// they went out, and for any that crossed a real-engagement threshold on
// their own platform, generates ONE follow-up post (same platform, queued
// into velocity_posts like any other row) pointing back at the original —
// "this is getting traction, here's why it matters, go check the thread."
//
// Engagement is read directly from each platform's own API using the
// platform_post_id/url captured by x-poster.mts, reddit-poster.mts, and
// bluesky-poster.mts at post time — nothing here is estimated or invented.
//
// Runs once daily, after all three posters have had a chance to post that
// day's content and after enough time has passed for the PREVIOUS day's
// posts to have accumulated real engagement.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { TwitterApi } from 'twitter-api-v2'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5'
const BATCH_SIZE = Number(process.env.ENGAGEMENT_SCAN_BATCH_SIZE || 5)

// Only look at posts inside this age window — old enough to have real
// engagement, not so old that a follow-up reads as stale.
const MIN_HOURS = Number(process.env.ENGAGEMENT_CHECK_MIN_HOURS || 20)
const MAX_HOURS = Number(process.env.ENGAGEMENT_CHECK_MAX_HOURS || 48)

// Thresholds are deliberately platform-specific — raw like/upvote counts
// aren't comparable across platforms with very different audience sizes.
const X_LIKES_THRESHOLD = Number(process.env.BOOST_X_LIKES_THRESHOLD || 15)
const REDDIT_UPVOTES_THRESHOLD = Number(process.env.BOOST_REDDIT_UPVOTES_THRESHOLD || 10)
const BLUESKY_LIKES_THRESHOLD = Number(process.env.BOOST_BLUESKY_LIKES_THRESHOLD || 15)

const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'jblessd-velocity-engine/1.0 by u/MultiNicheAI81'
const BLUESKY_PUBLIC_API = 'https://public.api.bsky.app'

type Platform = 'x' | 'reddit' | 'bluesky' | 'youtube_shorts'

interface ScanRow {
  id: string
  platform: Platform
  content: string
  platform_post_id: string | null
  platform_post_url: string | null
}

interface EngagementResult {
  metric: number // the single number compared against that platform's threshold
  label: string // human-readable summary for the follow-up prompt, e.g. "42 likes, 6 reposts"
}

// --- Per-platform engagement lookups ---------------------------------------

async function getXEngagement(tweetId: string): Promise<EngagementResult | null> {
  const apiKey = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null

  const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
  const tweet = await client.readOnly.v2.singleTweet(tweetId, { 'tweet.fields': ['public_metrics'] })
  const m = tweet.data?.public_metrics
  if (!m) return null
  return {
    metric: m.like_count,
    label: `${m.like_count} likes, ${m.retweet_count} reposts, ${m.reply_count} replies`,
  }
}

async function getRedditEngagement(fullname: string): Promise<EngagementResult | null> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  const username = process.env.REDDIT_USERNAME
  const password = process.env.REDDIT_PASSWORD
  if (!clientId || !clientSecret || !username || !password) return null

  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: 'password', username, password }),
  })
  if (!tokenRes.ok) throw new Error(`reddit token request failed: ${tokenRes.status}`)
  const tokenData = (await tokenRes.json()) as { access_token?: string }
  if (!tokenData.access_token) throw new Error('no reddit access_token in response')

  const infoRes = await fetch(`https://oauth.reddit.com/api/info?id=${encodeURIComponent(fullname)}`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': REDDIT_USER_AGENT },
  })
  if (!infoRes.ok) throw new Error(`reddit info request failed: ${infoRes.status}`)
  const infoData = (await infoRes.json()) as { data?: { children?: Array<{ data?: { ups?: number; num_comments?: number } }> } }
  const post = infoData.data?.children?.[0]?.data
  if (!post || typeof post.ups !== 'number') return null
  return {
    metric: post.ups,
    label: `${post.ups} upvotes, ${post.num_comments ?? 0} comments`,
  }
}

async function getBlueskyEngagement(uri: string): Promise<EngagementResult | null> {
  // getPosts is on Bluesky's public AppView — no auth needed for read-only
  // engagement counts on a public post.
  const res = await fetch(`${BLUESKY_PUBLIC_API}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`)
  if (!res.ok) throw new Error(`bluesky getPosts failed: ${res.status}`)
  const data = (await res.json()) as { posts?: Array<{ likeCount?: number; repostCount?: number; replyCount?: number }> }
  const post = data.posts?.[0]
  if (!post || typeof post.likeCount !== 'number') return null
  return {
    metric: post.likeCount,
    label: `${post.likeCount} likes, ${post.repostCount ?? 0} reposts, ${post.replyCount ?? 0} replies`,
  }
}

async function getEngagement(platform: Platform, postId: string): Promise<EngagementResult | null> {
  switch (platform) {
    case 'x':
      return getXEngagement(postId)
    case 'reddit':
      return getRedditEngagement(postId)
    case 'bluesky':
      return getBlueskyEngagement(postId)
    default:
      return null // youtube_shorts is a script, never auto-posted/tracked here
  }
}

function thresholdFor(platform: Platform): number {
  if (platform === 'x') return X_LIKES_THRESHOLD
  if (platform === 'reddit') return REDDIT_UPVOTES_THRESHOLD
  if (platform === 'bluesky') return BLUESKY_LIKES_THRESHOLD
  return Infinity
}

// --- Follow-up generation ---------------------------------------------------

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

async function generateBoostContent(
  anthropic: Anthropic,
  platform: Platform,
  originalContent: string,
  originalUrl: string,
  engagementLabel: string
): Promise<string> {
  const system =
    `You write follow-up content for MULTINICHE AI, a store whose differentiator is publishing REAL, ` +
    `dated proof of its tools working. An earlier post of theirs got real, measurable traction — write ONE ` +
    `short, platform-native follow-up post that references the traction factually (using the exact numbers ` +
    `given) and re-shares the original link with a fresh call-to-action. Do not invent numbers beyond what's ` +
    `given. Keep the tone matter-of-fact, not hype-y — the traction itself is the hook, it doesn't need ` +
    `embellishing. End with a clear action phrase directly before the URL, on its own line.\n\n` +
    (platform === 'x' || platform === 'bluesky'
      ? `Target platform: ${platform === 'x' ? 'X (Twitter), under 280 characters' : 'Bluesky, under 300 characters'}.\n\n`
      : `Target platform: Reddit — write it as "title\\n\\nbody" in one string, matching the original ` +
        `thread's plain, first-person tone.\n\n`) +
    `Return ONLY valid JSON: {"content": "..."}`

  const userMsg =
    `Original post:\n${originalContent}\n\n` +
    `Original URL: ${originalUrl}\n` +
    `Real engagement so far: ${engagementLabel}`

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: userMsg }],
  })

  const text = res.content.find((b) => b.type === 'text')?.text ?? '{}'
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  const content = String(parsed.content ?? '').trim()
  if (!content) throw new Error('empty boost content')
  return content
}

// --- Main --------------------------------------------------------------

export default async (_req: Request) => {
  const db = getDatabase()

  const rows = (await db.sql`
    SELECT id, platform, content, platform_post_id, platform_post_url
    FROM velocity_posts
    WHERE status = 'posted'
      AND engagement_checked_at IS NULL
      AND platform_post_id IS NOT NULL
      AND posted_at < now() - (${MIN_HOURS} || ' hours')::interval
      AND posted_at > now() - (${MAX_HOURS} || ' hours')::interval
    ORDER BY posted_at ASC
    LIMIT ${BATCH_SIZE}
  `) as ScanRow[]

  if (!rows.length) {
    console.log('[engagement-scanner] nothing in the check window')
    return Response.json({ scanned: 0, boosted: 0 })
  }

  const anthropic = new Anthropic()
  let scanned = 0
  let boosted = 0

  for (const row of rows) {
    scanned++
    let engagement: EngagementResult | null = null
    try {
      engagement = await getEngagement(row.platform, row.platform_post_id as string)
    } catch (err) {
      console.error(`[engagement-scanner] lookup failed for ${row.id} (${row.platform}):`, (err as Error).message)
    }

    // Mark checked regardless of outcome — a lookup failure shouldn't cause
    // the same row to be retried forever; the next day's fresh posts matter
    // more than relentlessly re-checking one that errored.
    await db.sql`UPDATE velocity_posts SET engagement_checked_at = now() WHERE id = ${row.id}`

    if (!engagement) continue

    const threshold = thresholdFor(row.platform)
    console.log(`[engagement-scanner] ${row.id} (${row.platform}): ${engagement.label} — threshold ${threshold}`)
    if (engagement.metric < threshold) continue
    if (!row.platform_post_url) continue

    try {
      const boostContent = await generateBoostContent(
        anthropic,
        row.platform,
        row.content,
        row.platform_post_url,
        engagement.label
      )
      await db.sql`
        INSERT INTO velocity_posts (id, source_type, source_id, platform, content, status)
        VALUES (${shortId()}, 'boost', ${row.id}, ${row.platform}, ${boostContent}, 'queued')
      `
      boosted++
      console.log(`[engagement-scanner] queued boost follow-up for ${row.id}`)
    } catch (err) {
      console.error(`[engagement-scanner] boost generation failed for ${row.id}:`, (err as Error).message)
    }
  }

  return Response.json({ scanned, boosted })
}

export const config: Config = {
  // Once daily, after all three posters (12:00, 15:00, 16:30, 17:30 UTC)
  // have run for the day and the prior day's posts have had time to
  // accumulate real engagement.
  schedule: '0 19 * * *',
}
