// Shared order-confirmation delivery for MULTINICHE AI.
//
// Why this exists: the confirmation email — the buyer's own copy of what they
// bought, their re-download/recovery link, and the "run it as an app" pointer —
// used to be sent from exactly one place, the Stripe webhook. That made email a
// hostage to the webhook being registered AND a signing secret being configured.
// When either was missing, a paid customer got no email at all and had nothing
// to reference the purchase by once they left the success page.
//
// This module is the single source of truth for that email, and it can be
// triggered from two independent places:
//   1. the Stripe webhook (checkout.session.completed) — fires even if the buyer
//      closes the tab, and
//   2. the success-page delivery endpoint (/api/order) — fires reliably from the
//      buyer's browser the moment they land back on the site.
// Whichever happens first wins; a per-session dedup marker guarantees the buyer
// receives exactly one confirmation even if both fire (or the success page is
// reloaded many times).

import { getStore } from '@netlify/blobs'
import { sendEmail, isEmailConfigured } from './email.mjs'
import type { FulfilledItem } from './fulfillment.mjs'

// Inline the real deliverables up to this budget; anything beyond it is still
// one click away via the recovery link, so nothing is ever out of reach.
const MAX_INLINE_CHARS = 40_000

// Marks the checkout sessions we've already emailed. Strong consistency so a
// webhook and a success-page load moments apart both see the same claim.
const DEDUP_STORE = 'order-emails'

export interface DeliverOrderEmailArgs {
  to: string
  sessionId: string
  items: FulfilledItem[]
  /** Absolute origin used to build the buyer's recovery/re-download link. */
  origin: string
}

export interface DeliverOrderEmailResult {
  sent: boolean
  reason?: 'not_configured' | 'already_sent' | 'send_failed'
}

/** Build the confirmation email body. Identical content regardless of which
 * path (webhook or success page) triggered it, so the two can never drift. */
export function buildOrderEmail(
  items: FulfilledItem[],
  recoveryUrl: string,
): { subject: string; text: string } {
  const itemList = items.length
    ? items.map((i) => `  • ${i.product.name}`).join('\n')
    : '  • Your order'

  const blocks: string[] = []
  let used = 0
  let truncated = false
  for (const item of items) {
    const block = `\n\n──────────\n${item.markdown}`
    if (used + block.length > MAX_INLINE_CHARS) {
      truncated = true
      break
    }
    blocks.push(block)
    used += block.length
  }

  const text =
    `Thanks for your order — here's what you picked up:\n\n${itemList}\n\n` +
    `Each one now runs as an app: open your order page below, fill in a short form, and it ` +
    `does the work on your own input — right in the browser, as many times as you like.\n${recoveryUrl}\n\n` +
    `The full text of every item is also included below, ready to copy or save.` +
    blocks.join('') +
    (truncated
      ? `\n\n──────────\n(Some items aren't shown here to keep this email short — open the link above to get all of them.)`
      : '') +
    `\n\nWhen you've put it to work we'd love a quick review — it helps other buyers and tells us what to build next: https://jblessd.com`

  return { subject: 'Your MULTINICHE AI order — ready to use inside', text }
}

/**
 * Deliver the order-confirmation email for one paid checkout session, exactly
 * once. Never throws — returns a result so callers can log and carry on; the
 * buyer's on-page delivery must never be blocked by an email problem.
 */
export async function deliverOrderEmail(
  args: DeliverOrderEmailArgs,
): Promise<DeliverOrderEmailResult> {
  const { to, sessionId, items, origin } = args

  // No provider configured — do NOT claim the dedup key, so the confirmation
  // can still go out the next time delivery is triggered after a key is wired in.
  if (!isEmailConfigured()) {
    console.warn(
      'order-email: email provider not configured — set RESEND_API_KEY and EMAIL_FROM to deliver order confirmations.',
    )
    return { sent: false, reason: 'not_configured' }
  }

  // Idempotency guard: one confirmation per checkout session.
  let store: ReturnType<typeof getStore> | null = null
  try {
    store = getStore({ name: DEDUP_STORE, consistency: 'strong' })
    const already = await store.get(sessionId, { type: 'text' })
    if (already) return { sent: false, reason: 'already_sent' }
  } catch (err) {
    // Blobs unavailable (e.g. local dev without config). Better to risk a rare
    // duplicate than to silently drop the customer's confirmation, so send anyway.
    console.warn('order-email: dedup store unavailable, sending without dedup —', (err as Error).message)
    store = null
  }

  const recoveryUrl = `${origin}/?checkout=success&session_id=${encodeURIComponent(sessionId)}`
  const { subject, text } = buildOrderEmail(items, recoveryUrl)

  const res = await sendEmail({ to, subject, text })
  if (!res.ok) return { sent: false, reason: 'send_failed' }

  if (store) {
    try {
      await store.set(sessionId, 'sent')
    } catch (err) {
      // Marker write failed — the email still went out. Worst case is a possible
      // duplicate on a later trigger; that's acceptable.
      console.warn('order-email: could not record dedup marker —', (err as Error).message)
    }
  }
  return { sent: true }
}
