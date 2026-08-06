// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Adapter: Netlify scheduled function.
//
// Copy this file to netlify/functions/site-audit.mts in your own site, copy the
// lib/ folder to netlify/lib/site-audit/, and set the two import paths below.
//
// COST NOTE, because it is the reason this package exists in the first place:
// a scheduled function is billed per invocation, and every request it makes back
// to your own site is billed AGAIN as an inbound request. An audit that crawls 25
// pages is ~30 requests, so ~31 billed events per run. Hourly, that is ~22k
// events a month. Daily, it is ~930. The schedule below is daily for that reason.
// If you want it more often than daily, run it from GitHub Actions instead
// (adapters/github-actions.yml) — those runners are free for public repos and
// their requests to your site are ordinary traffic, not doubled function billing.

import type { Config } from '@netlify/functions'
import { auditSite } from '../lib/site-audit/audit.mjs'
import { notify } from '../lib/site-audit/notify.mjs'

// The site to audit. URL is set by Netlify to your production URL automatically.
const TARGET = process.env.AUDIT_TARGET || process.env.URL || ''

// Optional Slack/Discord/Zapier webhook. Unset means "log only".
const WEBHOOK = process.env.AUDIT_WEBHOOK

export default async () => {
  if (!TARGET) {
    console.error('No audit target: set AUDIT_TARGET or deploy so URL is populated.')
    return new Response('No target configured', { status: 500 })
  }

  const report = await auditSite(TARGET, {
    // Keep the page budget small. Each page is a billed inbound request, and the
    // generic checks do not get more accurate past the first couple of dozen.
    maxPages: 15,
    concurrency: 4,
    userAgent: 'site-audit-agent/1.0 (scheduled self-audit)',
  })

  // Structured single-line log so it is greppable in the Netlify log drain.
  console.log(
    JSON.stringify({
      event: 'site_audit',
      target: report.target,
      status: report.status,
      score: report.score,
      failed: report.checks.filter((c) => c.status === 'failed').map((c) => c.name),
      durationMs: report.durationMs,
    }),
  )

  await notify(report, WEBHOOK, { when: 'problems' })

  return Response.json({ status: report.status, score: report.score, summary: report.summary })
}

export const config: Config = {
  // Once a day, at 03:12 UTC. Off the hour on purpose: scheduled jobs everywhere
  // pile onto :00, and there is no reason to join the queue.
  schedule: '12 3 * * *',
}
