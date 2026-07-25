// The one email the credit system sends: "here is your access key".
//
// A prepaid balance is worthless to a customer who can't reach it, and the key
// is deliberately unrecoverable from the database (only its hash is stored), so
// this message is the durable copy. Kept in one place because three paths send
// it — the Stripe webhook after a purchase, the browser's own claim on return
// from Checkout, and the "email me my key" recovery link.
//
// Email delivery is optional site-wide (see lib/email.mts): with no provider key
// configured this no-ops and logs. That's why every purchase path also returns
// the key in its HTTP response — the customer is never locked out just because
// email isn't wired up yet.

import { sendEmail } from './email.mjs'

export interface AccessKeyEmailArgs {
  to: string
  /** Plaintext key, when a new one was issued. Omitted on a top-up that reused
   * the customer's existing key — we cannot re-send what we don't store. */
  key?: string
  creditsAdded?: number
  balance: number
  origin: string
  reason: 'purchase' | 'recovery'
}

export async function sendAccessKeyEmail(args: AccessKeyEmailArgs): Promise<void> {
  const studio = `${args.origin}/agent`
  const lines: string[] = []

  if (args.reason === 'purchase') {
    lines.push(
      args.creditsAdded
        ? `Your ${args.creditsAdded} credits are live. Balance: ${args.balance} credits.`
        : `Your credits are live. Balance: ${args.balance} credits.`,
    )
  } else {
    lines.push(`Here's a fresh access key for your Claude Agent Studio balance of ${args.balance} credits.`)
  }

  if (args.key) {
    lines.push(
      `Access key:\n${args.key}`,
      `Paste it into the studio to unlock your balance:\n${studio}`,
      `Keep this key somewhere safe — it is the only thing needed to spend your credits, and it is not stored in a recoverable form on our side. If you ever request a new one, this key stops working.`,
    )
  } else {
    lines.push(
      `The credits were added to the access key you already have. Open the studio and your new balance is there:\n${studio}`,
      `Lost the key? Use "Email me a new key" on that page and we'll issue a fresh one.`,
    )
  }

  lines.push(`Credits never expire. Spend them whenever the work shows up.`)

  await sendEmail({
    to: args.to,
    subject:
      args.reason === 'purchase'
        ? `Your Claude Agent Studio credits are ready`
        : `Your new Claude Agent Studio access key`,
    text: lines.join('\n\n'),
  })
}
