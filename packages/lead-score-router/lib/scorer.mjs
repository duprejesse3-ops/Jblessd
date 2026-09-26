// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a lead + your ICP description into a scoring prompt, and turns
// Claude's reply back into a 0-100 score plus a one-line reason. Asks for a
// fixed, labeled-line format (not JSON) — see lead-research-agent's
// lib/enrichment.mjs for the same reasoning: a small model reproduces
// "Label: value" far more reliably than well-formed JSON.

/**
 * @param {object} lead  {name, email, company, message, source, ...}
 * @param {string} icpDescription
 * @returns {string}
 */
export function buildScoringPrompt(lead, icpDescription) {
  const fields = Object.entries(lead)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  return [
    'You are scoring an inbound sales lead against this company\'s ideal customer profile.',
    `Ideal customer profile: ${icpDescription}`,
    '',
    'Lead details:',
    fields || '(no details provided)',
    '',
    'Reply with exactly these two labeled lines and nothing else.',
    'Score: <a whole number 0-100, how well this lead matches the ideal customer profile>',
    'Reason: <one short sentence explaining the score>',
  ].join('\n')
}

/**
 * @param {string} responseText
 * @returns {{score:number, reason:string}}
 */
export function parseScoreResponse(responseText) {
  const scoreMatch = /^score:\s*(\d{1,3})/im.exec(responseText)
  const reasonMatch = /^reason:\s*(.+)$/im.exec(responseText)

  if (!scoreMatch) throw new Error(`Could not find a "Score:" line in the model's response: ${responseText.slice(0, 200)}`)

  const score = Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10)))
  const reason = reasonMatch ? reasonMatch[1].trim() : ''
  return { score, reason }
}
