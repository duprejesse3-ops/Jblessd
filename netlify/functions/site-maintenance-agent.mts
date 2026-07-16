import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { inspectSite, type HealthReport } from '../lib/site-health.mjs'

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
  const recommendation = await diagnose(report)

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO site_health_runs (status, summary, recommendation, checks, duration_ms)
      VALUES (${report.status}, ${report.summary}, ${recommendation}, ${JSON.stringify(report.checks)}::jsonb, ${report.durationMs})
    `
    await db.sql`DELETE FROM site_health_runs WHERE created_at < now() - interval '30 days'`
  } catch (error) {
    console.error('site maintenance persistence failed:', error instanceof Error ? error.message : 'unknown error')
  }

  console.log(`site maintenance: ${report.status} — ${report.summary}`)
}

export const config: Config = {
  schedule: '*/15 * * * *',
}
