// Cron for the four scheduled functions.
//
// Netlify runs these from platform infrastructure; in a container they need a
// scheduler of their own. This one evaluates the cron expressions the functions
// already declare in `export const config`, so the schedules are not duplicated
// anywhere and changing one in the function changes it here.
//
// Ticking once a minute against a field matcher is the right shape for four
// jobs whose finest granularity is hourly. It deliberately does not try to be a
// general cron implementation: step values, ranges, lists and wildcards are
// supported because the existing expressions use them, and nothing else is.

const ALIASES = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

/** Expands one cron field into the set of values it matches. */
function fieldMatcher(field, min, max) {
  const allowed = new Set()

  for (const part of field.split(',')) {
    const [range, stepText] = part.split('/')
    const step = stepText ? Number(stepText) : 1
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad step "${part}"`)

    let start = min
    let end = max
    if (range !== '*') {
      const [from, to] = range.split('-')
      start = Number(from)
      end = to === undefined ? (stepText ? max : Number(from)) : Number(to)
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`bad range "${part}"`)
      }
    }

    for (let value = start; value <= end; value += step) allowed.add(value)
  }

  return allowed
}

export function parseCron(expression) {
  const normalized = ALIASES[expression.trim()] ?? expression.trim()
  const fields = normalized.split(/\s+/)
  if (fields.length !== 5) throw new Error(`expected 5 cron fields, got ${fields.length}`)

  return {
    minute: fieldMatcher(fields[0], 0, 59),
    hour: fieldMatcher(fields[1], 0, 23),
    dayOfMonth: fieldMatcher(fields[2], 1, 31),
    month: fieldMatcher(fields[3], 1, 12),
    // Cron allows 7 for Sunday; normalise it to 0 so the Date lookup matches.
    dayOfWeek: new Set([...fieldMatcher(fields[4], 0, 7)].map((d) => (d === 7 ? 0 : d))),
  }
}

/**
 * Schedules run on UTC, matching Netlify, so a container in another timezone
 * fires its jobs at the same wall-clock moment as the platform did.
 */
export function cronMatches(parsed, date) {
  if (!parsed.minute.has(date.getUTCMinutes())) return false
  if (!parsed.hour.has(date.getUTCHours())) return false
  if (!parsed.month.has(date.getUTCMonth() + 1)) return false

  // Standard cron quirk: when both day-of-month and day-of-week are restricted
  // the job runs if *either* matches, not both.
  const domRestricted = parsed.dayOfMonth.size !== 31
  const dowRestricted = parsed.dayOfWeek.size !== 7

  const domHit = parsed.dayOfMonth.has(date.getUTCDate())
  const dowHit = parsed.dayOfWeek.has(date.getUTCDay())

  if (domRestricted && dowRestricted) return domHit || dowHit
  if (domRestricted) return domHit
  if (dowRestricted) return dowHit
  return true
}

export function startScheduler({ functions, siteUrl, enabled = true }) {
  const jobs = []

  for (const fn of functions) {
    if (!fn.schedule) continue
    try {
      jobs.push({ name: fn.name, handler: fn.handler, cron: parseCron(fn.schedule), expression: fn.schedule })
    } catch (error) {
      console.error(`scheduler: ignoring ${fn.name} — ${error.message}`)
    }
  }

  if (!jobs.length) return { jobs: [], stop() {} }

  if (!enabled) {
    console.log(
      `scheduler: disabled, ${jobs.length} job(s) will not run — ${jobs.map((j) => j.name).join(', ')}`,
    )
    return { jobs, stop() {} }
  }

  console.log(
    `scheduler: ${jobs.map((j) => `${j.name} (${j.expression})`).join(', ')}`,
  )

  let running = false
  let lastMinute = null

  async function tick() {
    const now = new Date()
    const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`
    // The interval can drift and fire twice inside one minute; this makes a job
    // run at most once per scheduled minute.
    if (minuteKey === lastMinute) return
    lastMinute = minuteKey

    // Overlap guard: a crawl that takes longer than a minute must not be
    // started again on top of itself.
    if (running) return
    running = true

    try {
      for (const job of jobs) {
        if (!cronMatches(job.cron, now)) continue
        const startedAt = Date.now()
        try {
          // Scheduled handlers read `new URL(req.url).origin` to know which
          // site to crawl or ping, so this must be the real public URL and not
          // localhost — otherwise the crawler audits the container's loopback.
          await job.handler(
            new Request(`${siteUrl}/.netlify/functions/${job.name}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ next_run: null }),
            }),
            {},
          )
          console.log(`scheduler: ${job.name} finished in ${Date.now() - startedAt}ms`)
        } catch (error) {
          console.error(`scheduler: ${job.name} failed — ${error.message}`)
        }
      }
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => {
    tick().catch((error) => console.error('scheduler: tick failed —', error.message))
  }, 30_000)
  timer.unref?.()

  return { jobs, stop: () => clearInterval(timer) }
}
