// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Loads and validates config.json — the routing rules: what your ideal
// customer looks like (for the scoring prompt) and the score thresholds
// that decide which tier (and which Slack webhook) a lead is routed to.
// Kept as plain JSON, not code, so a non-developer on the team can adjust
// the criteria or thresholds without touching the script.

import { readFileSync } from 'node:fs'

/**
 * @param {string} path
 * @returns {{icpDescription:string, tiers:Array<{name:string,minScore:number,webhookUrl?:string}>}}
 */
export function loadConfig(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(`Could not read config file at "${path}": ${err.message}`)
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`"${path}" is not valid JSON: ${err.message}`)
  }

  if (!parsed.icpDescription || typeof parsed.icpDescription !== 'string') {
    throw new Error(`"${path}" must set "icpDescription" (a short description of your ideal customer).`)
  }
  if (!Array.isArray(parsed.tiers) || parsed.tiers.length === 0) {
    throw new Error(`"${path}" must define at least one entry in "tiers".`)
  }

  const tiers = parsed.tiers.map((tier, i) => validateTier(tier, i, path))
  return { icpDescription: parsed.icpDescription, tiers: tiers.slice().sort((a, b) => b.minScore - a.minScore) }
}

function validateTier(tier, i, path) {
  if (!tier.name || typeof tier.name !== 'string') {
    throw new Error(`"${path}" tier ${i} is missing required field "name".`)
  }
  if (typeof tier.minScore !== 'number' || tier.minScore < 0 || tier.minScore > 100) {
    throw new Error(`"${path}" tier ${i} ("${tier.name}"): "minScore" must be a number between 0 and 100.`)
  }
  return { name: tier.name, minScore: tier.minScore, webhookUrl: tier.webhookUrl ?? null }
}

/**
 * Picks the highest tier whose minScore the given score meets or exceeds.
 * Tiers must already be sorted descending by minScore (loadConfig does this).
 *
 * @param {number} score
 * @param {Array<{name:string,minScore:number,webhookUrl?:string|null}>} tiers
 * @returns {{name:string,minScore:number,webhookUrl?:string|null}|null}
 */
export function tierForScore(score, tiers) {
  for (const tier of tiers) {
    if (score >= tier.minScore) return tier
  }
  return null
}
