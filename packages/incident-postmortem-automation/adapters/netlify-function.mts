// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Same logic as adapters/pagerduty-webhook.mjs, as a Netlify Function — no
// machine to keep running, no tunnel needed to give PagerDuty a public URL.
// Drop this file into your own site's netlify/functions/ directory (rename
// or keep as pagerduty-postmortem.mts) and point PagerDuty's webhook at
// https://your-site.netlify.app/.netlify/functions/pagerduty-postmortem
//
// Requires the same three environment variables as the standalone server —
// set them in Netlify's site settings, not in this file:
//   PAGERDUTY_WEBHOOK_SECRET, PAGERDUTY_API_TOKEN, SLACK_WEBHOOK_URL,
//   ANTHROPIC_API_KEY

import type { Config } from '@netlify/functions'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { draftPostmortem } from '../../lib/postmortem.mjs'
import { postToSlack } from '../../lib/slack.mjs'

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return header
    .split(',')
    .map((s) => s.trim().replace(/^v1=/, ''))
    .some((sig) => {
      try {
        return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      } catch {
        return false
      }
    })
}

async function fetchTimeline(incidentId: string, token: string | undefined): Promise<string> {
  if (!token) return '(No PAGERDUTY_API_TOKEN set — drafting from the resolution event only.)'
  const res = await fetch(
    `https://api.pagerduty.com/incidents/${incidentId}/log_entries?limit=100&time_zone=UTC`,
    { headers: { Authorization: `Token token=${token}`, Accept: 'application/vnd.pagerduty+json;version=2' } },
  )
  if (!res.ok) return `(Could not fetch log entries: HTTP ${res.status})`
  const data = await res.json()
  const entries = data.log_entries ?? []
  return (
    entries.map((e: any) => `${e.created_at} — ${e.channel?.summary ?? e.summary ?? e.type}`).join('\n') ||
    '(no log entries returned)'
  )
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  const secret = process.env.PAGERDUTY_WEBHOOK_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })

  const rawBody = await req.text()
  if (!verifySignature(rawBody, req.headers.get('x-pagerduty-signature'), secret)) {
    return new Response('bad signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('bad json', { status: 400 })
  }

  const event = payload?.event
  if (event?.event_type !== 'incident.resolved') {
    return new Response('ignored', { status: 200 })
  }

  const incident = event.data
  try {
    const timeline = await fetchTimeline(incident.id, process.env.PAGERDUTY_API_TOKEN)
    const draft = await draftPostmortem(timeline, { incidentTitle: incident.title })
    await postToSlack(draft, process.env.SLACK_WEBHOOK_URL)
    return Response.json({ drafted: true, incidentId: incident.id })
  } catch (err) {
    console.error(`Failed to draft postmortem for incident ${incident?.id}:`, (err as Error).message)
    // Still 200 — PagerDuty would otherwise retry a webhook it already delivered.
    return Response.json({ drafted: false, error: (err as Error).message })
  }
}

export const config: Config = {
  path: '/pagerduty-postmortem',
}
