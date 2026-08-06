// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional webhook notifier.
//
// An unattended audit is only useful if it can reach you. Rather than integrate a
// mail provider (an account, an API key, a dependency, a bill), this posts JSON to
// a URL you already have: a Slack or Discord incoming webhook, a Zapier catch
// hook, or your own endpoint. Slack and Discord both accept a bare `content`/`text`
// field, so one payload shape covers all three.
//
// Silent when no webhook is configured, and never throws — a failed notification
// must not turn a successful audit into a crashed job.

const MAX_LINES = 12

function summarise(report) {
  const problems = report.checks.filter((c) => c.status === 'failed')
  const warnings = report.checks.filter((c) => c.status === 'warning')

  const lines = [`${report.target} — score ${report.score}/100 (${report.status})`]
  for (const check of problems.slice(0, MAX_LINES)) lines.push(`✗ ${check.name}: ${check.detail}`)
  if (problems.length > MAX_LINES) lines.push(`…and ${problems.length - MAX_LINES} more problems`)
  if (warnings.length) lines.push(`${warnings.length} warning(s) not listed`)
  return lines.join('\n')
}

/**
 * Post a report to a webhook. Returns true if the webhook accepted it.
 *
 * @param {object} report            a report from auditSite()
 * @param {string|undefined} webhookUrl
 * @param {object} [options]
 * @param {'always'|'problems'} [options.when='problems']  'problems' stays quiet
 *   on a healthy site, which is what you want for a job running every night
 * @param {number} [options.timeoutMs=8000]
 */
export async function notify(report, webhookUrl, { when = 'problems', timeoutMs = 8000 } = {}) {
  if (!webhookUrl) return false
  if (when === 'problems' && report.status === 'healthy') return false

  const text = summarise(report)
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // `text` for Slack, `content` for Discord, both for anything else.
      body: JSON.stringify({ text, content: text, report }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.warn(`Webhook returned HTTP ${response.status}`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`Webhook failed: ${error?.message ?? error}`)
    return false
  }
}
