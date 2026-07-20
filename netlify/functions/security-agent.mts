import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { scanSite, type SecurityReport } from '../lib/security-scan.mjs'

const MODEL = 'claude-haiku-4-5'

function fallbackRecommendation(report: SecurityReport): string {
  const issues = report.checks.filter((check) => check.status !== 'passed')
  if (!issues.length) return 'No action is needed.'
  return issues.map((check) => `${check.name}: ${check.detail}`).join(' ')
}

async function diagnose(report: SecurityReport): Promise<string> {
  if (report.status === 'secure') return 'No action is needed.'

  try {
    const anthropic = new Anthropic()
    const issues = report.checks
      .filter((check) => check.status !== 'passed')
      .map(({ name, status, detail }) => ({ name, status, detail }))
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 240,
      messages: [
        {
          role: 'user',
          content:
            'Act as a web security assistant for a static site hosted on Netlify. Give the site owner one ' +
            'concise, safe remediation recommendation for these automated security check results. Do not claim ' +
            'to have changed code, deployed, or fixed anything. Prioritize critical issues (exposed files, no ' +
            `HTTPS) before missing headers. Results: ${JSON.stringify(issues)}`,
        },
      ],
    })
    const text = message.content.find((block) => block.type === 'text')
    return text?.type === 'text' && text.text.trim() ? text.text.trim().slice(0, 1200) : fallbackRecommendation(report)
  } catch (error) {
    console.error('security diagnosis failed:', error instanceof Error ? error.message : 'unknown error')
    return fallbackRecommendation(report)
  }
}

export default async (req: Request) => {
  const report = await scanSite(new URL(req.url).origin)
  const recommendation = await diagnose(report)

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO security_scan_runs (status, summary, recommendation, checks, duration_ms)
      VALUES (${report.status}, ${report.summary}, ${recommendation}, ${JSON.stringify(report.checks)}::jsonb, ${report.durationMs})
    `
    await db.sql`DELETE FROM security_scan_runs WHERE created_at < now() - interval '30 days'`
  } catch (error) {
    console.error('security scan persistence failed:', error instanceof Error ? error.message : 'unknown error')
  }

  console.log(`security scan: ${report.status} — ${report.summary}`)
}

export const config: Config = {
  schedule: '0 */6 * * *',
}
