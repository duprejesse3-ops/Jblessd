// Netlify Function (scheduled): free-pack nurture sequence.
//
// Runs daily. Finds subscribers whose next_email_at has arrived, sends them
// the next email in the sequence (lib/nurture-sequence.mjs), then advances
// their nurture_step and schedules the following one — or clears next_email_at
// once the sequence is exhausted, so they naturally stop getting emails.
//
// Mirrors the pattern in indexnow-submit.mts: scheduled functions can't be
// invoked over HTTP on Netlify, so this file is just the schedule + a thin
// loop; nothing here needs to be reusable elsewhere.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { sendEmail } from '../lib/email.mjs'
import { buildNurtureEmail, DELAY_DAYS, TOTAL_STEPS } from '../lib/nurture-sequence.mjs'

const SITE_URL = process.env.SITE_URL || 'https://jblessd.com'
const BATCH_SIZE = 30

// Best-effort review aggregates for step 2's social-proof email. A failure
// here should never block the nurture run — it just falls back to no quote.
async function fetchAggregates(): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${SITE_URL}/api/reviews`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return {}
    const data = (await res.json()) as { aggregates?: Record<string, any> }
    return data.aggregates ?? {}
  } catch {
    return {}
  }
}

export default async () => {
  const db = getDatabase()

  let due: any[] = []
  try {
    due = (await db.sql`
      SELECT email, nurture_step
      FROM subscribers
      WHERE unsubscribed = false
        AND next_email_at IS NOT NULL
        AND next_email_at <= now()
      ORDER BY next_email_at ASC
      LIMIT ${BATCH_SIZE}
    `) as any[]
  } catch (err) {
    console.error('nurture-send: could not query due subscribers —', (err as Error).message)
    return Response.json({ sent: 0, error: 'query failed' }, { status: 500 })
  }

  if (!due.length) {
    console.log('nurture-send: no subscribers due')
    return Response.json({ sent: 0 })
  }

  const { products } = await loadCatalog()
  const aggregates = await fetchAggregates()

  let sent = 0
  for (const row of due) {
    const nextStep = Number(row.nurture_step) + 1
    const email = String(row.email)

    if (nextStep > TOTAL_STEPS) {
      // Shouldn't normally happen (next_email_at is cleared after the last
      // step), but guard against it anyway rather than looping forever.
      try {
        await db.sql`UPDATE subscribers SET next_email_at = NULL WHERE lower(email) = lower(${email})`
      } catch (err) {
        console.error('nurture-send: could not clear finished subscriber —', (err as Error).message)
      }
      continue
    }

    const built = buildNurtureEmail(nextStep, products, aggregates, email, SITE_URL)
    if (!built) {
      console.error(`nurture-send: no email content for step ${nextStep}, skipping ${email}`)
      continue
    }

    const unsubUrl = `${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(Buffer.from(email).toString('base64'))}`
    const text = `${built.text}\n\n---\nDon't want these? Unsubscribe: ${unsubUrl}`

    try {
      await sendEmail({ to: email, subject: built.subject, text })
      sent++
    } catch (err) {
      console.error(`nurture-send: failed to send step ${nextStep} to ${email} —`, (err as Error).message)
      continue // don't advance their step if the send failed — retry next run
    }

    const isLastStep = nextStep >= TOTAL_STEPS
    try {
      if (isLastStep) {
        await db.sql`
          UPDATE subscribers
          SET nurture_step = ${nextStep}, next_email_at = NULL
          WHERE lower(email) = lower(${email})
        `
      } else {
        const followingDelay = DELAY_DAYS[nextStep + 1] - DELAY_DAYS[nextStep]
        await db.sql`
          UPDATE subscribers
          SET nurture_step = ${nextStep},
              next_email_at = now() + (${followingDelay} || ' days')::interval
          WHERE lower(email) = lower(${email})
        `
      }
    } catch (err) {
      console.error(`nurture-send: sent to ${email} but failed to advance their step —`, (err as Error).message)
    }
  }

  console.log(`nurture-send: sent ${sent}/${due.length}`)
  return Response.json({ sent, attempted: due.length })
}

export const config: Config = {
  // Once a day, off-peak. The exact hour doesn't matter — subscribers are
  // matched on next_email_at <= now(), not on a specific time of day.
  schedule: '0 15 * * *',
}
