// Scheduled function: site maintenance / health agent.
//
// This is the missing piece that was writing to site_health_runs — the table,
// the read endpoint (site-status.mts), the admin-console "site_health" tool,
// and the recommendation-caching helper (agent-diagnosis.mts, which already
// has 'site_health_runs' wired into its RunTable type) all existed and
// expected this function to exist, but no scheduled function actually called
// netlify/lib/site-health.mts's inspectSite() and persisted the result. That
// gap meant /api/site-status silently stopped getting new rows at some point
// with no error anywhere — the dashboard just froze on the last real run
// instead of failing loudly.
//
// Mirrors discovery-crawler.mts's structure exactly: run the check, reuse the
// previous recommendation when the set of failing checks hasn't changed
// (cachedRecommendation), otherwise ask Claude for a fresh one, persist, and
// prune history once a day.

import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { inspectSite, type HealthReport } from '../lib/site-health.mjs'
import { cachedRecommendation, diagnosisFingerprint, shouldPruneHistory } from '../lib/agent-diagnosis.mjs'

const MODEL = 'claude-haiku-4-5'

function fallbackRecommendation(report: HealthReport): string {
  if (report.status === 'healthy') return 'No action is needed.'
  return report.checks
    .filter((check) => check.status !== 'passed')
    .map((check) => `${check.name}: ${check.detail}`)
    .join(' ')
}

async function diagnose(report: HealthReport): Promise<string> {
  if (report.status === 'healthy') return 'No action is needed.'

  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 260,
      messages: [
        {
          role: 'user',
          content:
            'Act as a site-reliability analyst. An automated check just probed a storefront\'s homepage, ' +
            'catalog API, review API, and sitemap. Give the site owner one concise, safe recommendation to ' +
            'restore or improve availability. If every check failed with the same HTTP status (e.g. every ' +
            'check returns 401 or 403, including the homepage itself), say plainly that this pattern points ' +
            'at something blocking ALL public traffic at the hosting/platform level — most commonly a site-wide ' +
            'password-protection or visitor-access-control setting left enabled on the production deploy — ' +
            'rather than a credential problem with any single internal service, since a genuine per-service ' +
            'credential issue would not also break a public, unauthenticated homepage. Do not claim to have ' +
            'changed code, deployed, or fixed anything. ' +
            `Failing/warning checks: ${JSON.stringify(report.checks.filter((c) => c.status !== 'passed'))}`,
        },
      ],
    })
    const text = message.content.find((block) => block.type === 'text')
    return text?.type === 'text' && text.text.trim() ? text.text.trim().slice(0, 1200) : fallbackRecommendation(report)
  } catch (error) {
    console.error('site health diagnosis failed:', error instanceof Error ? error.message : 'unknown error')
    return fallbackRecommendation(report)
  }
}

export default async (req: Request) => {
  const report = await inspectSite(new URL(req.url).origin)

  // As in discovery-crawler.mts: an unchanged set of failing checks reuses the
  // previous recommendation instead of paying for an identical LLM answer.
  const fingerprint = diagnosisFingerprint(report.status, report.checks)
  const reused = report.status === 'healthy' ? null : await cachedRecommendation('site_health_runs', fingerprint)
  const recommendation = reused ?? (await diagnose(report))

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO site_health_runs (status, summary, recommendation, checks, duration_ms)
      VALUES (
        ${report.status},
        ${report.summary},
        ${recommendation},
        ${JSON.stringify(report.checks)}::jsonb,
        ${report.durationMs}
      )
    `
    if (shouldPruneHistory()) {
      await db.sql`DELETE FROM site_health_runs WHERE created_at < now() - interval '30 days'`
    }
  } catch (error) {
    console.error('site health persistence failed:', error instanceof Error ? error.message : 'unknown error')
  }

  console.log(
    `site health: ${report.status} — ${report.summary}${reused ? ' (recommendation reused, no LLM call)' : ''}`,
  )

  return Response.json({ status: report.status, summary: report.summary })
}

export const config: Config = {
  // Hourly — matches the cadence visible in the site_health_runs history
  // (each row roughly an hour apart) so this restores the exact behavior
  // that was already relied on elsewhere (site-status.mts, admin console),
  // not a new cadence.
  schedule: '0 * * * *',
}
