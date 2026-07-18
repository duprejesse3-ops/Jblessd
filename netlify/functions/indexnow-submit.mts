// Scheduled function: keep Bing's index in sync by pushing our sitemap URLs to
// IndexNow twice a day.
//
// This is the active half of "get Bing to index the site" — robots.txt, the
// sitemap, the verification file, and per-page metadata already tell Bing the
// pages are crawlable; IndexNow tells it they exist and to come get them now.
//
// Netlify does not allow scheduled functions to be invoked over HTTP, so the
// submission logic lives in ../lib/indexnow.mjs and can be reused elsewhere
// (e.g. after a product is added) without going through this endpoint.

import type { Config } from '@netlify/functions'
import { sitemapUrls, submitUrls } from '../lib/indexnow.mjs'

export default async (req: Request) => {
  const origin = new URL(req.url).origin
  try {
    const urls = await sitemapUrls(origin)
    const result = await submitUrls(urls)
    const accepted = result.status > 0 && result.status < 400
    console.log(`indexnow: submitted ${result.submitted} URLs — endpoint HTTP ${result.status}`)
    return Response.json({ ok: accepted, submitted: result.submitted, status: result.status })
  } catch (error) {
    console.error('indexnow submit failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ ok: false, error: 'submission failed' }, { status: 502 })
  }
}

export const config: Config = {
  // Twice daily is plenty for a small, slowly-changing catalog; the manual
  // trigger covers the "I just added a product" case in between.
  schedule: '0 */12 * * *',
}
