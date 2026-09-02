// Shared logic for fulfilling a paid custom order: generates a real,
// structured deliverable via Claude (not a quick chat answer — a document
// matching the store's catalog-product quality bar), saves it, and emails it
// to the buyer using the site's shared email module. Called from both the
// webhook (reliable, server-triggered) and the success-page browser trigger
// (fast, user-triggered) — idempotent on status, so whichever path gets
// there first does the work and the other is a no-op.

import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'
import { sendEmail } from './email.mts'

const MODEL = 'claude-opus-5'

const CATEGORY_GUIDANCE = {
  prompts: 'a complete, ready-to-use prompt (or short set of prompts) with clear instructions for how and where to use it',
  automations: 'a step-by-step automation blueprint: the trigger, each concrete step, the tools/services involved, and the end result',
  templates: 'a filled-in, ready-to-use document template — structured, with placeholder sections clearly marked where the buyer customizes it further',
  agents: 'a full agent configuration: its role, instructions, example interactions, and constraints — ready to drop into an AI assistant',
}

export async function fulfilCustomOrder(orderId) {
  const db = getDatabase()

  const [order] = await db.sql`SELECT * FROM custom_orders WHERE id = ${orderId}`
  if (!order) {
    console.error(`fulfilCustomOrder: no order found for id ${orderId}`)
    return
  }
  if (order.status === 'delivered' || order.status === 'generating') {
    return
  }

  await db.sql`UPDATE custom_orders SET status = 'generating' WHERE id = ${orderId}`

  try {
    const guidance = CATEGORY_GUIDANCE[order.category] || CATEGORY_GUIDANCE.prompts

    const anthropic = new Anthropic()
    const system =
      `You produce paid, professional-grade deliverables for MULTINICHE AI, a store selling AI ` +
      `productivity tools. A customer has paid $49 for a CUSTOM deliverable built specifically for ` +
      `their described need — this is not a quick answer, it is a real, complete, usable artifact ` +
      `they will actually use in their work.\n\n` +
      `Category: ${order.category}. The deliverable should be ${guidance}.\n\n` +
      `Write in Markdown. Include a short title, then the full deliverable. Be concrete and specific ` +
      `to what the customer described — no generic filler, no "here are some ideas" — deliver the ` +
      `actual finished thing they paid for. Aim for genuine depth and usability, the way a skilled ` +
      `freelancer would deliver a paid commission.`

    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: order.need_description }],
    })

    const output = res.content.find((b) => b.type === 'text')?.text ?? ''
    if (!output || output.length < 100) {
      throw new Error('generation produced insufficient output')
    }

    await db.sql`
      UPDATE custom_orders
      SET output = ${output}, status = 'delivered', delivered_at = now()
      WHERE id = ${orderId}
    `

    if (order.email) {
      const categoryLabel = order.category.charAt(0).toUpperCase() + order.category.slice(1)
      await sendEmail({
        to: order.email,
        subject: `Your custom ${categoryLabel} is ready`,
        text: `Your custom deliverable is ready. Here it is:\n\n${output}`,
      })
    }
  } catch (err) {
    console.error(`fulfilCustomOrder: generation failed for ${orderId} —`, err.message)
    await db.sql`UPDATE custom_orders SET status = 'failed' WHERE id = ${orderId}`
  }
}

// Set the buyer's email on the order once Stripe reports it (needed because
// the checkout session doesn't have the email until the buyer actually enters
// payment details — the order row is created before that happens).
export async function attachOrderEmail(orderId, email) {
  const db = getDatabase()
  await db.sql`UPDATE custom_orders SET email = ${email} WHERE id = ${orderId} AND email IS NULL`
}
