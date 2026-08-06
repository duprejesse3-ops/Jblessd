import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { inspectSite, type HealthReport } from '../lib/site-health.mjs'
import { cachedRecommendation, diagnosisFingerprint, shouldPruneHistory } from '../lib/agent-diagnosis.mjs'

const MODEL = 'claude-haiku-4-5'

function fallbackRecommendation(report: HealthReport): string {
  const issues = report.checks.filter((check) => check.status !== 'passed')
  if (!issues.length) return 'No action is needed.'
  return issues.map((check) => `${check.name}: ${check.detail}`).join(' ')
}

async function diagnose(report: HealthReport): Promise<string> {
  if (report.status === 'healthy') return 'No action is needed.'

  try {
    const anthropic = new Anthropic()
    const issues = report.checks
      .filter((check) => check.status !== 'passed')
      .map(({ name, status, latencyMs, detail }) => ({ name, status, latencyMs, detail }))
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 240,
      messages: [
        {
          role: 'user',
          content:
            'Act as a website reliability assistant. Give the site owner one concise, safe repair recommendation ' +
            'for these automated check results. Do not claim to have changed code, deployed, or fixed anything. ' +
            `Prioritize availability, then structured data, then speed. Results: ${JSON.stringify(issues)}`,
        },
      ],
    })
    const text = message.content.find((block) => block.type === 'text')
    return text?.type === 'text' && text.text.trim() ? text.text.trim().slice(0, 1200) : fallbackRecommendation(report)
  } catch (error) {
    console.error('site maintenance diagnosis failed:', error instanceof Error ? error.message : 'unknown error')
    return fallbackRecommendation(report)
  }
}

export default async (req: Request) => {
  const report = await inspectSite(new URL(req.url).origin)

  // Only pay Claude when the problem is actually new. A site that has been
  // sitting on the same failing check since the last run gets last run's
  // recommendation copied forward — same information, no inference cost.
  const fingerprint = diagnosisFingerprint(report.status, report.checks)
  const reused = report.status === 'healthy' ? null : await cachedRecommendation('site_health_runs', fingerprint)
  const recommendation = reused ?? (await diagnose(report))

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO site_health_runs (status, summary, recommendation, checks, duration_ms)
      VALUES (${report.status}, ${report.summary}, ${recommendation}, ${JSON.stringify(report.checks)}::jsonb, ${report.durationMs})
    `
    // Retention is enforced once a day rather than on every run — see
    // shouldPruneHistory.
    if (shouldPruneHistory()) {
      await db.sql`DELETE FROM site_health_runs WHERE created_at < now() - interval '30 days'`
    }
  } catch (error) {
    console.error('site maintenance persistence failed:', error instanceof Error ? error.message : 'unknown error')
  }

  console.log(
    `site maintenance: ${report.status} — ${report.summary}${reused ? ' (recommendation reused, no LLM call)' : ''}`,
  )
}

export const config: Config = {
  // Hourly. This was every 15 minutes, which is uptime-monitor cadence for a
  // job that exists to keep a health *history* for the admin console: each run
  // costs a scheduled invocation plus five self-requests against our own
  // functions and edge functions, so quartering the frequency removes roughly
  // three quarters of that traffic while still catching a real outage inside
  // the hour.
  schedule: '0 * * * *',
}
