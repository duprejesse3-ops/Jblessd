// Shared cost control for the scheduled "agent" functions.
//
// Both the site maintenance agent and the discovery crawler end their run by
// asking Claude to turn a set of failing checks into one plain-English
// recommendation. That call is the most expensive thing either function does,
// and it was being paid for on *every* run — even though a scheduled agent
// almost always sees the exact same problem it saw last time. A single slow
// endpoint left unfixed for a day used to buy 96 identical LLM answers.
//
// The insight is that the recommendation is a pure function of the *failing
// checks*, not of the run. So we fingerprint the checks, compare that against
// the most recent stored run, and only pay for a fresh answer when the
// fingerprint actually changes. A steady-state problem now costs one LLM call
// instead of one per run, and the admin console still shows a current
// recommendation on every row because we copy the previous one forward.
//
// The fingerprint is derived from the `checks` jsonb already persisted by both
// agents, so this needs no schema change and no new migration.

import { getDatabase } from '@netlify/database'

/** The subset of a check that determines what the advice should say. */
type FingerprintableCheck = {
  name?: string
  status?: string
  detail?: string
  // latencyMs is deliberately NOT part of the fingerprint: it changes on every
  // run by a few milliseconds, which would defeat the cache entirely. A latency
  // *warning* still changes `status`, so a check that crosses the slow
  // threshold does trigger a fresh diagnosis.
}

/**
 * Stable identity for "the set of things currently wrong with the site".
 *
 * Only non-passing checks contribute — a passing check carries no advice — and
 * the entries are sorted so that a reordered `Promise.all` result does not read
 * as a different problem.
 */
export function diagnosisFingerprint(status: string, checks: FingerprintableCheck[]): string {
  const problems = (Array.isArray(checks) ? checks : [])
    .filter((check) => check?.status !== 'passed')
    .map((check) => `${check?.name ?? ''}|${check?.status ?? ''}|${check?.detail ?? ''}`)
    .sort()
  return `${status}::${problems.join('::')}`
}

/** Tables whose rows carry a (status, checks, recommendation) triple. */
type RunTable = 'site_health_runs' | 'crawl_runs'

/**
 * Return the previous run's recommendation when it was produced for an
 * identical set of problems, or null when a fresh diagnosis is warranted.
 *
 * A DB error here is not fatal: we fall through to null and the caller pays for
 * a real diagnosis, which is the old behaviour. Never let a cost optimisation
 * become an availability risk.
 */
export async function cachedRecommendation(
  table: RunTable,
  fingerprint: string,
): Promise<string | null> {
  try {
    const db = getDatabase()
    const rows =
      table === 'site_health_runs'
        ? ((await db.sql`
            SELECT status, checks, recommendation
            FROM site_health_runs
            ORDER BY created_at DESC
            LIMIT 1
          `) as any[])
        : ((await db.sql`
            SELECT status, checks, recommendation
            FROM crawl_runs
            ORDER BY created_at DESC
            LIMIT 1
          `) as any[])

    const previous = rows?.[0]
    if (!previous?.recommendation) return null

    const checks = typeof previous.checks === 'string' ? JSON.parse(previous.checks) : previous.checks
    return diagnosisFingerprint(String(previous.status ?? ''), checks ?? []) === fingerprint
      ? String(previous.recommendation)
      : null
  } catch (error) {
    console.error(
      `cachedRecommendation(${table}) lookup failed:`,
      error instanceof Error ? error.message : 'unknown error',
    )
    return null
  }
}

/**
 * Whether this run should also do its daily housekeeping.
 *
 * Both agents used to issue a `DELETE ... WHERE created_at < now() - interval
 * '30 days'` on every single run, which is a scan of the whole table to delete
 * nothing 99% of the time. Retention only needs to be enforced once a day, so
 * we gate it on a single hour and let every other run skip it.
 */
export function shouldPruneHistory(hourUtc = new Date().getUTCHours()): boolean {
  return hourUtc === 4
}
