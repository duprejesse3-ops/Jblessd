import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { crawlSite, type DiscoveryReport } from '../lib/crawler.mjs'

const MODEL = 'claude-haiku-4-5'

function fallbackRecommendation(report: DiscoveryReport): string {
  if (report.status === 'healthy') return 'No action is needed.'
  if (report.issues.length) return report.issues.slice(0, 5).join(' ')
  return report.checks
    .filter((check) => check.status !== 'passed')
    .map((check) => `${check.name}: ${check.detail}`)
    .join(' ')
}

async function diagnose(report: DiscoveryReport): Promise<string> {
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
            'Act as an SEO crawl analyst. A bot crawled a storefront by following internal links and compared what ' +
            'it found against the sitemap and the live product catalog. Give the site owner one concise, safe ' +
            'recommendation to improve how discoverable the pages are. Prioritize broken links, then products that ' +
            'cannot be reached by following links, then sitemap mismatches. Do not claim to have changed code, ' +
            'deployed, or fixed anything. ' +
            `Failing/warning checks: ${JSON.stringify(report.checks.filter((c) => c.status !== 'passed'))}. ` +
            `Specific gaps: ${JSON.stringify(report.issues.slice(0, 12))}`,
        },
      ],
    })
    const text = message.content.find((block) => block.type === 'text')
    return text?.type === 'text' && text.text.trim() ? text.text.trim().slice(0, 1200) : fallbackRecommendation(report)
  } catch (error) {
    console.error('discovery crawler diagnosis failed:', error instanceof Error ? error.message : 'unknown error')
    return fallbackRecommendation(report)
  }
}

export default async (req: Request) => {
  const report = await crawlSite(new URL(req.url).origin)
  const recommendation = await diagnose(report)

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO crawl_runs (status, summary, recommendation, checks, metrics, duration_ms)
      VALUES (
        ${report.status},
        ${report.summary},
        ${recommendation},
        ${JSON.stringify(report.checks)}::jsonb,
        ${JSON.stringify({ ...report.metrics, issues: report.issues })}::jsonb,
        ${report.durationMs}
      )
    `
    await db.sql`DELETE FROM crawl_runs WHERE created_at < now() - interval '30 days'`
  } catch (error) {
    console.error('discovery crawler persistence failed:', error instanceof Error ? error.message : 'unknown error')
  }

  console.log(`discovery crawler: ${report.status} — ${report.summary}`)
}

export const config: Config = {
  // Runs less often than the uptime check — a full link-graph crawl is heavier
  // and discovery gaps change on the scale of content edits, not minutes.
  schedule: '0 */6 * * *',
}
