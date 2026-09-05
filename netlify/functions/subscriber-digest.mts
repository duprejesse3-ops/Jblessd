// Scheduled Netlify Function: weekly subscriber digest.
//
// The store captures emails (the `subscribers` table, via the free-pack lead
// magnet) but until now never contacted anyone again — a warm list going cold.
// This runs once a week and emails subscribers a short digest of the newest
// tools in the catalog, turning one-time visitors into repeat buyers.
//
// Scheduled functions only run on published production deploys (never previews),
// so this cannot fire from a branch. If no email provider is configured the
// sends are graceful no-ops (see lib/email), so this is safe to ship before the
// RESEND_API_KEY is wired.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL } from '../lib/catalog.mjs'
import { sendEmail, isEmailConfigured } from '../lib/email.mjs'

const SITE = 'https://multinicheai.com'
const MAX_RECIPIENTS = 500 // safety cap for a single scheduled run
const CONCURRENCY = 10
const FEATURED_COUNT = 5

export default async () => {
  if (!isEmailConfigured()) {
    console.warn('subscriber-digest: no email provider configured — skipping run.')
    return
  }

  // The newest tools: loadCatalog orders by id ascending, so the tail is newest.
  const { products } = await loadCatalog()
  const featured = products.slice(-FEATURED_COUNT).reverse()
  if (!featured.length) {
    console.warn('subscriber-digest: empty catalog — skipping run.')
    return
  }

  let emails: string[] = []
  try {
    const db = getDatabase()
    const rows = (await db.sql`
      SELECT email FROM subscribers ORDER BY last_requested_at DESC LIMIT ${MAX_RECIPIENTS}
    `) as Array<{ email: string }>
    emails = rows.map((r) => r.email).filter(Boolean)
  } catch (err) {
    console.error('subscriber-digest: could not load subscribers —', (err as Error).message)
    return
  }

  if (!emails.length) {
    console.log('subscriber-digest: no subscribers yet.')
    return
  }

  const lines = featured
    .map((p) => `• ${p.name} — ${CATEGORY_LABEL[p.category]}, $${p.price.toFixed(2)}\n  ${p.blurb}\n  ${SITE}/product/${encodeURIComponent(p.sku)}`)
    .join('\n\n')

  const text =
    `Here's what's new at MULTINICHE AI — ready-to-run AI tools you can watch work before you buy.\n\n` +
    `${lines}\n\n` +
    `Browse everything, or run any tool live on your own task first: ${SITE}\n\n` +
    `— The MULTINICHE AI team\n\n` +
    `You're getting this because you grabbed a free prompt pack at multinicheai.com. Reply to unsubscribe.`

  const subject = `New at MULTINICHE AI: ${featured[0].name} and more`

  // Send individually (one recipient per message) so addresses stay private.
  // Chunk the sends to stay well within the scheduled-function time budget.
  let sent = 0
  for (let i = 0; i < emails.length; i += CONCURRENCY) {
    const chunk = emails.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map((to) => sendEmail({ to, subject, text })))
    sent += results.filter((r) => r.ok).length
  }

  console.log(`subscriber-digest: sent ${sent}/${emails.length} digest emails.`)
}

export const config: Config = {
  schedule: '@weekly',
}
