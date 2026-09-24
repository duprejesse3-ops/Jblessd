#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A zero-dependency HTTP server that listens for PagerDuty's
// `incident.resolved` webhook, pulls the incident's real timeline from
// PagerDuty's API, drafts a blameless postmortem with Claude, and posts it to
// Slack — with no human running a command. This is the piece that turns
// "a blueprint you follow" into an automation that actually runs itself.
//
// Setup (PagerDuty side):
//   1. PagerDuty -> Integrations -> Generic Webhooks (v3) -> add endpoint,
//      pointed at wherever this server is reachable (see "Exposing this"
//      below), subscribed to "Incident Resolved".
//   2. Copy the signing secret PagerDuty shows you into PAGERDUTY_WEBHOOK_SECRET.
//   3. Create a PagerDuty API token (My Profile -> User Settings -> API
//      Access) with read access, for PAGERDUTY_API_TOKEN — needed to fetch
//      the incident's log entries, which the webhook payload itself doesn't
//      include.
//
// Run it:
//   node adapters/pagerduty-webhook.mjs
//
// Exposing this to PagerDuty: PagerDuty needs a public HTTPS URL. On your own
// machine, a tunnel (ssh -R, cloudflared, ngrok) is the fastest way to test;
// for real use, deploy this behind whatever reverse proxy fronts your other
// services (nginx, Caddy) or use adapters/netlify-function.mts instead, which
// doesn't need a machine kept running at all.

import { createServer } from 'node:http'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { draftPostmortem } from '../lib/postmortem.mjs'
import { postToSlack } from '../lib/slack.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const WEBHOOK_SECRET = process.env.PAGERDUTY_WEBHOOK_SECRET
const PD_API_TOKEN = process.env.PAGERDUTY_API_TOKEN
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

if (!WEBHOOK_SECRET) {
  console.error('PAGERDUTY_WEBHOOK_SECRET is not set — refusing to start unverified.')
  process.exit(1)
}

function verifySignature(rawBody, header) {
  if (!header) return false
  // PagerDuty sends "v1=<hex>", possibly multiple space-separated signatures
  // during secret rotation — accept a match against any of them.
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
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

async function fetchTimeline(incidentId) {
  if (!PD_API_TOKEN) {
    return `(No PAGERDUTY_API_TOKEN set — drafting from the resolution event only, no detailed log entries.)`
  }
  const res = await fetch(
    `https://api.pagerduty.com/incidents/${incidentId}/log_entries?limit=100&time_zone=UTC`,
    { headers: { Authorization: `Token token=${PD_API_TOKEN}`, Accept: 'application/vnd.pagerduty+json;version=2' } },
  )
  if (!res.ok) return `(Could not fetch log entries: HTTP ${res.status})`
  const data = await res.json()
  const entries = data.log_entries ?? []
  return entries.map((e) => `${e.created_at} — ${e.channel?.summary ?? e.summary ?? e.type}`).join('\n') || '(no log entries returned)'
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('POST only')
    return
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const rawBody = Buffer.concat(chunks)

  if (!verifySignature(rawBody, req.headers['x-pagerduty-signature'])) {
    console.warn('Rejected webhook: bad signature')
    res.writeHead(401).end('bad signature')
    return
  }

  // Acknowledge immediately — PagerDuty retries on anything but a fast 2xx,
  // and the postmortem draft can take several seconds.
  res.writeHead(202).end('accepted')

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    console.warn('Rejected webhook: invalid JSON')
    return
  }

  const event = payload?.event
  if (event?.event_type !== 'incident.resolved') return // ignore everything else

  const incident = event.data
  try {
    const timeline = await fetchTimeline(incident.id)
    const draft = await draftPostmortem(timeline, { incidentTitle: incident.title })
    const posted = await postToSlack(draft, SLACK_WEBHOOK_URL)
    console.log(`Drafted postmortem for incident ${incident.id}${posted ? ' — posted to Slack' : ' — Slack not configured or failed'}`)
  } catch (err) {
    console.error(`Failed to draft postmortem for incident ${incident?.id}: ${err.message}`)
  }
})

server.listen(PORT, () => {
  console.log(`Listening for PagerDuty webhooks on :${PORT}`)
  if (!PD_API_TOKEN) console.warn('PAGERDUTY_API_TOKEN not set — timelines will be minimal.')
  if (!SLACK_WEBHOOK_URL) console.warn('SLACK_WEBHOOK_URL not set — drafts will only be logged, not posted.')
})
