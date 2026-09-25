#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point: reads config.json, reads the sitemap it points at, checks
// every URL it lists (HEAD, falling back to GET), optionally follows
// outbound links off the pages that came back OK, builds a report, and
// emails it. Safe to run as often as you like — nothing is written to disk
// and there is no state to corrupt between runs.

import { loadConfig } from '../lib/config.mjs'
import { fetchSitemapUrls } from '../lib/sitemap.mjs'
import { checkUrl } from '../lib/checker.mjs'
import { mapWithConcurrency } from '../lib/concurrency.mjs'
import { discoverExternalLinks } from '../lib/crawl.mjs'
import { buildReport, buildEmailHtml, buildSummaryText } from '../lib/report.mjs'
import { sendDigestEmail } from '../lib/mailer.mjs'
import { postSummary } from '../lib/slack.mjs'

async function main() {
  const configPath = process.env.LINK_WATCHDOG_CONFIG_PATH ?? new URL('../config.json', import.meta.url).pathname
  const config = loadConfig(configPath)

  console.log(`Fetching sitemap: ${config.sitemapUrl}`)
  const sitemapUrls = await fetchSitemapUrls(config.sitemapUrl, { timeoutMs: config.requestTimeoutMs })
  if (!sitemapUrls.length) {
    throw new Error(`Sitemap at "${config.sitemapUrl}" listed no URLs — nothing to check.`)
  }
  console.log(`${sitemapUrls.length} URL(s) listed in the sitemap. Checking (concurrency: ${config.concurrency})...`)

  const sitemapResults = await mapWithConcurrency(sitemapUrls, config.concurrency, async (url) => {
    const result = await checkUrl(url, { timeoutMs: config.requestTimeoutMs })
    return { ...result, foundOn: 'sitemap.xml' }
  })

  let externalResults = []
  if (config.checkExternalLinks && config.externalLinkLimit > 0) {
    const okPages = sitemapResults.filter((r) => r.classification === 'ok').map((r) => r.finalUrl)
    console.log(`Scanning up to ${okPages.length} page(s) for outbound links (cap: ${config.externalLinkLimit})...`)
    const externalLinks = await discoverExternalLinks(okPages, {
      timeoutMs: config.requestTimeoutMs,
      limit: config.externalLinkLimit,
    })
    console.log(`Found ${externalLinks.length} distinct external link(s). Checking...`)
    externalResults = await mapWithConcurrency(externalLinks, config.concurrency, async ({ url, foundOn }) => {
      const result = await checkUrl(url, { timeoutMs: config.requestTimeoutMs })
      return { ...result, foundOn }
    })
  }

  const report = buildReport([...sitemapResults, ...externalResults], {
    siteName: process.env.SITE_NAME,
    sitemapUrl: config.sitemapUrl,
  })

  console.log('')
  console.log(buildSummaryText(report))
  console.log('')

  const sent = await sendDigestEmail({
    to: config.toEmail,
    subject: `Link & uptime check — ${report.brokenCount} broken${process.env.SITE_NAME ? ` — ${process.env.SITE_NAME}` : ''}`,
    html: buildEmailHtml(report),
    text: buildSummaryText(report),
    fromName: process.env.SITE_NAME,
  })
  console.log(sent ? 'Digest email sent.' : 'Digest email not sent (dry run — RESEND_API_KEY not set).')

  await postSummary(report, process.env.SLACK_WEBHOOK_URL)
}

main().catch((err) => {
  console.error(`link-watchdog failed: ${err.message}`)
  process.exitCode = 1
})
