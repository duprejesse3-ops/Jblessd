import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

interface SecurityRunRow {
  status: 'healthy' | 'degraded' | 'unhealthy'
  summary: string
  recommendation: string
  checks: unknown
  metrics: unknown
  duration_ms: number
  created_at: string | Date
}

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  try {
    const db = getDatabase()
    const rows = (await db.sql`
      SELECT status, summary, recommendation, checks, metrics, duration_ms, created_at
      FROM security_runs
      ORDER BY created_at DESC, id DESC
      LIMIT 12
    `) as SecurityRunRow[]
    const runs = (rows ?? []).map((row) => ({
      status: row.status,
      summary: row.summary,
      recommendation: row.recommendation,
      checks: row.checks,
      metrics: row.metrics,
      durationMs: Number(row.duration_ms),
      scannedAt: new Date(row.created_at).toISOString(),
    }))

    return Response.json(
      { current: runs[0] ?? null, history: runs },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    console.error('security status failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json(
      { current: null, history: [], message: 'Security history becomes available after the first scheduled scan.' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export const config: Config = {
  path: '/api/security-status',
}
