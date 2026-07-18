// Shared transactional-email sender for MULTINICHE AI.
//
// The store finally has an owned audience (the `subscribers` table) and real
// orders (Stripe), but until now nothing was ever *sent* to anyone: the free
// pack was only handed back in the HTTP response, and the Stripe webhook just
// logged. This module is the one place that actually delivers email, so every
// caller (free-pack delivery, order receipts, the weekly subscriber digest)
// behaves the same and degrades the same.
//
// Provider: Resend (https://resend.com) via its plain HTTPS API — no SDK, no
// key management beyond two env vars:
//   RESEND_API_KEY  — the provider key (required to actually send)
//   EMAIL_FROM      — the verified From address, e.g. "MULTINICHE AI <hello@multinicheai.com>"
//
// If RESEND_API_KEY is not set the sender is a no-op that logs and returns
// { ok:false, skipped:true }. That is deliberate: the site must keep working on
// a fresh deploy or preview branch where no email provider is configured yet,
// exactly like the AI features fall back when the gateway isn't active. Wiring a
// key in later turns delivery on with zero code changes.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface EmailMessage {
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
}

export interface EmailResult {
  ok: boolean
  skipped?: boolean
  id?: string
  error?: string
}

function getEnv(name: string): string {
  // Netlify.env is the canonical accessor inside functions, but fall back to
  // process.env so this module is also usable from plain Node contexts/tests.
  try {
    const v = (globalThis as any).Netlify?.env?.get?.(name)
    if (v) return String(v)
  } catch {
    /* not in a Netlify function context */
  }
  return process.env[name] ?? ''
}

/** Whether a real provider key AND a From address are configured. Both are
 * required: sending from Resend's shared sandbox address only reaches the
 * account owner, so without an explicit verified EMAIL_FROM every customer
 * send would be rejected. Treat that as "not configured" and no-op instead. */
export function isEmailConfigured(): boolean {
  return getEnv('RESEND_API_KEY').length > 0 && getEnv('EMAIL_FROM').length > 0
}

// Minimal, safe HTML escaping for turning plain-text bodies into an HTML part.
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c])
}

// A brand-consistent HTML wrapper so emails don't look like raw text. Kept
// deliberately simple (inline styles, dark on light) for broad client support.
function wrapHtml(bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
  return (
    `<div style="background:#f4f6f5;padding:28px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1f12">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8e4;border-radius:8px;overflow:hidden">` +
    `<div style="background:#000803;padding:18px 28px"><span style="color:#00FF41;font-weight:700;letter-spacing:.04em">MULTINICHE AI</span></div>` +
    `<div style="padding:28px">${paragraphs}</div>` +
    `<div style="padding:16px 28px;border-top:1px solid #eef2ef;font-size:12px;color:#6b7d70">` +
    `MULTINICHE AI · <a href="https://multinicheai.com" style="color:#0a7d2c">multinicheai.com</a></div>` +
    `</div></div>`
  )
}

/**
 * Send one email. Never throws — returns a result object so callers can log and
 * carry on. When no provider key is configured it logs and returns skipped:true.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = getEnv('RESEND_API_KEY')
  const from = getEnv('EMAIL_FROM')
  const to = Array.isArray(msg.to) ? msg.to : [msg.to]

  if (!apiKey || !from) {
    console.warn(
      `email: RESEND_API_KEY and EMAIL_FROM must both be set — skipping send of "${msg.subject}" to ${to.length} recipient(s).`,
    )
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? wrapHtml(msg.text),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`email: provider rejected send (${res.status}) — ${detail.slice(0, 300)}`)
      return { ok: false, error: `provider_${res.status}` }
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('email: send failed —', (err as Error).message)
    return { ok: false, error: 'network' }
  }
}

/** Turn a plain-text body into a simple branded HTML part (exported for callers that build their own). */
export function toHtml(bodyText: string): string {
  return wrapHtml(bodyText)
}
