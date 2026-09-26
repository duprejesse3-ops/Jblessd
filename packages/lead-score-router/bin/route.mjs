#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point: reads leads.json (an array of lead objects, each with a
// stable "id" — email works fine), scores each new one against your ICP
// with Claude, decides which tier it lands in from config.json, and posts
// a routing message to that tier's Slack webhook. Already-routed leads (by
// id) are skipped on a re-run via state.json, so a nightly export that
// re-includes older rows never double-posts them.

import { readFileSync } from 'node:fs'
import { loadConfig, tierForScore } from '../lib/config.mjs'
import { buildScoringPrompt, parseScoreResponse } from '../lib/scorer.mjs'
import { callClaude } from '../lib/claude-client.mjs'
import { buildRoutingMessage, postToSlack } from '../lib/router.mjs'
import { loadState, saveState, hasBeenRouted, recordRouted } from '../lib/state.mjs'

function leadId(lead) {
  return String(lead.id ?? lead.email ?? '').trim()
}

async function main() {
  const configPath = process.env.ROUTER_CONFIG_PATH ?? new URL('../config.json', import.meta.url).pathname
  const leadsPath = process.env.ROUTER_LEADS_JSON ?? new URL('../leads.json', import.meta.url).pathname
  const statePath = process.env.ROUTER_STATE_PATH ?? new URL('../state.json', import.meta.url).pathname

  const config = loadConfig(configPath)
  let state = loadState(statePath)

  const leads = JSON.parse(readFileSync(leadsPath, 'utf8'))
  if (!Array.isArray(leads)) throw new Error(`"${leadsPath}" must be a JSON array of leads.`)

  let routed = 0
  let skipped = 0
  let failed = 0

  for (const lead of leads) {
    const id = leadId(lead)
    if (!id) {
      console.warn('Skipping a lead with no "id" or "email" field — cannot dedupe it safely.')
      continue
    }
    if (hasBeenRouted(state, id)) {
      skipped++
      continue
    }

    try {
      const prompt = buildScoringPrompt(lead, config.icpDescription)
      const reply = await callClaude(prompt)
      const scoreResult = parseScoreResponse(reply)
      const tier = tierForScore(scoreResult.score, config.tiers)

      if (tier) {
        const message = buildRoutingMessage({ lead, scoreResult, tier })
        const sent = await postToSlack(tier.webhookUrl, message)
        console.log(`${id}: score ${scoreResult.score} -> ${tier.name}${sent ? ' (posted to Slack)' : tier.webhookUrl ? ' (Slack post failed)' : ' (no webhook configured, logged only)'}`)
      } else {
        console.log(`${id}: score ${scoreResult.score} -> below every tier threshold, logged only`)
      }

      state = recordRouted(state, id, { score: scoreResult.score, tier: tier?.name ?? 'none' })
      routed++
    } catch (err) {
      console.error(`Failed to score/route lead ${id}: ${err.message}`)
      failed++
    }
  }

  saveState(statePath, state)
  console.log(`\nDone. ${routed} routed, ${skipped} already routed, ${failed} failed.`)
}

main().catch((err) => {
  console.error(`lead-score-router failed: ${err.message}`)
  process.exitCode = 1
})
