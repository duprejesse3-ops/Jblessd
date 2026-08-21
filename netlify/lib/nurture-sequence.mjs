// Content for the free-pack nurture sequence. Three emails, spread out after
// someone claims the free prompt pack, each grounded in the real catalog (or a
// real review) rather than generic copy — the same "don't invent anything"
// principle the marketing agent follows.
//
// Steps are 1-indexed to match subscribers.nurture_step: step 0 means "just
// signed up, only the free-pack email has gone out." After step N sends,
// nurture_step becomes N and next_email_at is set to (signup + DELAY_DAYS[N])
// until the sequence is exhausted, at which point next_email_at is cleared.

const CATEGORY_LABEL = {
  prompts: 'Prompt Packs',
  automations: 'Automation Blueprints',
  templates: 'Doc Templates',
  agents: 'Agent Configs',
}

// Cumulative days after signup that each step should fire.
export const DELAY_DAYS = { 1: 2, 2: 5, 3: 9 }
export const TOTAL_STEPS = 3

function escapeForText(s) {
  return String(s ?? '').trim()
}

// Deterministic per-email pick so the same subscriber doesn't see a different
// spotlight product if this ever reruns, but different subscribers see variety.
function pickProduct(products, email, offset = 0) {
  if (!products.length) return null
  let hash = 0
  for (const ch of String(email)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return products[(hash + offset) % products.length]
}

function productLine(p, siteUrl) {
  const cat = p.catLabel ?? CATEGORY_LABEL[p.category] ?? p.category
  const detail = p.spec && p.spec !== '—' ? p.spec : p.format
  return {
    name: p.name,
    cat,
    detail,
    price: Number(p.price).toFixed(2),
    url: `${siteUrl}/product/${encodeURIComponent(p.sku)}`,
  }
}

// step 1 — spotlight a real product, 2 days after signup
function buildStep1(products, _aggregates, email, siteUrl) {
  const p = pickProduct(products, email, 1)
  if (!p) return null
  const item = productLine(p, siteUrl)
  return {
    subject: `The prompt pack was step one — here's step two`,
    text:
      `Hope the free pack's been useful.\n\n` +
      `Since you're already using prompts to move faster, here's one thing in the catalog worth a look: ` +
      `${item.name} (${item.cat}). ${item.detail ? `It's built as ${item.detail}.` : ''}\n\n` +
      `It's $${item.price}, one-time, no subscription: ${item.url}\n\n` +
      `— The MULTINICHE AI team`,
  }
}

// step 2 — real social proof, 5 days after signup
function buildStep2(products, aggregates, email, siteUrl) {
  const withReviews = products.filter((p) => aggregates[p.sku]?.sample)
  const p = withReviews.length ? pickProduct(withReviews, email, 2) : pickProduct(products, email, 2)
  if (!p) return null
  const item = productLine(p, siteUrl)
  const sample = aggregates[p.sku]?.sample
  const proof = sample
    ? `One buyer put it this way: "${escapeForText(sample.body)}" — ${escapeForText(sample.author)}.\n\n`
    : ''
  return {
    subject: `What people actually say about ${item.name}`,
    text:
      `${proof}` +
      `${item.name} is $${item.price} and ready the moment you check out: ${item.url}\n\n` +
      `— The MULTINICHE AI team`,
  }
}

// step 3 — closing note, 9 days after signup, no urgency tactics
function buildStep3(products, _aggregates, email, siteUrl) {
  const p = pickProduct(products, email, 3)
  const item = p ? productLine(p, siteUrl) : null
  return {
    subject: `Last note from us for a while`,
    text:
      `Not going to keep filling your inbox — this is the last email in this sequence.\n\n` +
      `The full catalog's organized by role (founders, developers, marketers, and more) at ${siteUrl}. ` +
      (item ? `If you want one place to start, ${item.name} is a solid pick: ${item.url}\n\n` : '\n') +
      `Everything's a one-time purchase, no subscriptions, and every tool can be run live on your own task before you buy.\n\n` +
      `— The MULTINICHE AI team`,
  }
}

const BUILDERS = { 1: buildStep1, 2: buildStep2, 3: buildStep3 }

/** Builds the email for a given step (1-3), or null if there's nothing sendable. */
export function buildNurtureEmail(step, products, aggregates, email, siteUrl) {
  const builder = BUILDERS[step]
  if (!builder) return null
  return builder(products, aggregates ?? {}, email, siteUrl)
}
