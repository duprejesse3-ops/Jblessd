// Live context for MultiSignal (AI-AG-115) only — fetched fresh on each
// run: recent headlines (shared with $Odds Agent, see live-fetch.mts) plus
// public Reddit discussion volume, so the model has two independent
// external signals to check against the buyer's internal number, not one.
//
// HONESTY FLAG, worth reading before this goes live: Reddit's public
// search JSON endpoint (no login, no API key) is a long-standing, widely
// used pattern, but Reddit has tightened anonymous/API access more
// aggressively and more often than most platforms — rate limits, a
// required realistic User-Agent, and occasional outright blocks for
// non-browser traffic. This is meaningfully more likely to need
// adjustment than the Google News RSS piece it sits next to. Verify with
// a handful of real queries before trusting it, and if it starts failing
// silently in production, this endpoint (not the news one) is the first
// place to look — the code below is written to degrade to "no Reddit
// signal found" rather than crash, but a fetch that always fails quietly
// is easy to not notice.

import { fetchWithTimeout, fetchRecentHeadlines, type Headline } from './live-fetch.mjs'

interface RedditPost {
  title: string
  subreddit: string
  date: string
  score: number
}

async function fetchRedditPosts(query: string, limit = 6): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&t=month`
  const res = await fetchWithTimeout(url)
  if (!res) return []
  try {
    const data = await res.json()
    const children = data?.data?.children
    if (!Array.isArray(children)) return []
    return children
      .map((c: any) => c?.data)
      .filter(Boolean)
      .map((d: any) => ({
        title: String(d.title ?? ''),
        subreddit: String(d.subreddit ?? ''),
        date: d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : '',
        score: Number(d.score ?? 0),
      }))
      .filter((p: RedditPost) => p.title)
  } catch {
    return []
  }
}

/**
 * Builds a live-context text block for AI-AG-115 combining recent headlines
 * and Reddit discussion for the given query — never throws, degrades to an
 * explicit "unavailable" note per source rather than silently omitting one.
 */
export async function fetchSignalLiveContext(query: string): Promise<string> {
  const [headlines, posts] = await Promise.all([fetchRecentHeadlines(query), fetchRedditPosts(query)])

  const parts: string[] = []
  if (headlines.length) {
    parts.push(
      'Recent headlines, fetched just now, most recent first:\n' +
        headlines.map((h: Headline) => `- ${h.title}${h.date ? ` (${h.date})` : ''}`).join('\n'),
    )
  } else {
    parts.push('No recent headlines were found for this query this run.')
  }
  if (posts.length) {
    parts.push(
      'Recent Reddit discussion, fetched just now (subreddit, date, score):\n' +
        posts.map((p) => `- "${p.title}" — r/${p.subreddit || 'unknown'}, ${p.date || 'undated'}, score ${p.score}`).join('\n'),
    )
  } else {
    parts.push('No recent Reddit discussion was found for this query this run — this source is less reliable than the headline search, see the honesty flag in this file\'s header comment.')
  }
  return parts.join('\n\n')
}
