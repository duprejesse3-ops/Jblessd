import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { scanSite, type SecurityReport } from '../lib/security-scan.mjs'

const MODEL = 'claude-haiku-4-5'

function fallbackRecommendation(report: SecurityReport): string {
  if (report.status === 'healthy') return 'No action is needed.'
  if (report.issues.length) return report.issues.slice(0, 5).join(' ')
  return 'Review the failing security checks.'
}

async function diagnose(report: SecurityReport): Promise<string> {
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
            'Act as a web application security analyst. A bot scanned a storefront\'s live HTTP response headers ' +
            'and graded its hardening against clickjacking, protocol downgrade, MIME sniffing, and referrer/permission ' +
            'leaks. Give the site owner one concise, safe recommendation to close the most important gaps. Prioritize ' +
            'missing critical headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) over recommended ones. Do ' +
            'not claim to have changed code, deployed, or fixed anything. ' +
            `Overall grade: ${report.metrics.grade}. ` +
            `Failing/warning checks: ${JSON.stringify(report.checks.filter((c) => c.status !== 'passed'))}`,
        },
      ],
    })
    const text = message.content.find((block) => block.type === 'text')
    return text?.type === 'text' && text.text.trim() ? text.text.trim().slice(0, 1200) : fallbackRecommendation(report)
  } catch (error) {
    console.error('security agent diagnosis failed:', error instanceof Error ? error.message : 'unknown error')
    return fallbackRecommendation(report)
  }
}

export default async (req: Request) => {
  const report = await scanSite(new URL(req.url).origin)
  const recommendation = await diagnose(report)

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO security_runs (status, summary, recommendation, checks, metrics, duration_ms)
      VALUES (
        ${report.status},
        ${report.summary},
        ${recommendation},
        ${JSON.stringify(report.checks)}::jsonb,
        ${JSON.stringify({ ...report.metrics, issues: report.issues })}::jsonb,
        ${report.durationMs}
      )
    `
    await db.sql`DELETE FROM security_runs WHERE created_at < now() - interval '30 days'`
  } catch (error) {
    console.error('security agent persistence failed:', error instanceof Error ? error.message : 'unknown error')
  }

  console.log(`security agent: ${report.status} — ${report.summary}`)
}

export const config: Config = {
  // Header hardening only changes when config or deploys change, so an hourly
  // sweep is plenty to catch a regression without hammering the site.
  schedule: '0 * * * *',
}
