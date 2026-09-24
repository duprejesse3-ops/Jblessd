// A thin client for your own self-hosted BTCPay Server, talking to its
// Greenfield REST API. This is deliberately NOT a hosted payment processor
// integration (Coinbase Commerce, BitPay, etc.) — BTCPay Server is free,
// open-source software you run yourself (see BTCPAY_SETUP.md at the repo
// root for what "run yourself" actually involves: a VPS, Docker, and either
// your own Lightning node or a channel with a liquidity provider). Nobody
// but you ever touches the keys or the funds.
//
// Required environment variables (Netlify: Site settings -> Environment
// variables):
//   BTCPAY_URL          e.g. https://btcpay.multinicheai.com  (your instance, no trailing slash)
//   BTCPAY_API_KEY       an API key from BTCPay's Account -> API Keys, scoped
//                         to "Create invoice" and "View invoices" for the
//                         store below — nothing broader.
//   BTCPAY_STORE_ID      the store id shown in BTCPay's Store settings
//   BTCPAY_WEBHOOK_SECRET the signing secret BTCPay shows you when you
//                         register the webhook (see btcpay-webhook.mts)
//
// This module intentionally does not fall back to a default/demo store the
// way analytics-config.mts does for Google Ads — an unconfigured Bitcoin
// payment path should fail loudly (see isConfigured()/requireConfig()) and
// simply not offer Bitcoin as an option, never silently point at nobody's
// invoice.

import crypto from 'node:crypto'

export interface BTCPayInvoiceItem {
  sku: string
  name: string
  priceCents: number
}

export interface CreatedInvoice {
  id: string
  checkoutLink: string
}

interface BTCPayConfig {
  baseUrl: string
  apiKey: string
  storeId: string
}

export function isConfigured(): boolean {
  return Boolean(process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID)
}

function requireConfig(): BTCPayConfig {
  const baseUrl = (process.env.BTCPAY_URL ?? '').trim().replace(/\/+$/, '')
  const apiKey = (process.env.BTCPAY_API_KEY ?? '').trim()
  const storeId = (process.env.BTCPAY_STORE_ID ?? '').trim()
  if (!baseUrl || !apiKey || !storeId) {
    throw new Error('BTCPay is not configured (BTCPAY_URL / BTCPAY_API_KEY / BTCPAY_STORE_ID)')
  }
  return { baseUrl, apiKey, storeId }
}

/**
 * Create a Lightning-only invoice for a cart. Amount is computed here from
 * the server-side catalog price, in USD — BTCPay converts to sats at its own
 * configured rate source when the invoice is displayed, same as Stripe never
 * sees "dollars converted to card network units" either. Metadata carries the
 * SKUs so the webhook can fulfil without re-deriving anything from the
 * (untrusted) browser.
 */
export async function createInvoice(
  items: BTCPayInvoiceItem[],
  opts: { orderId: string; origin: string; buyerEmail: string },
): Promise<CreatedInvoice> {
  const { baseUrl, apiKey, storeId } = requireConfig()

  const totalCents = items.reduce((sum, i) => sum + i.priceCents, 0)
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    throw new Error('Invalid invoice amount')
  }

  const res = await fetch(`${baseUrl}/api/v1/stores/${storeId}/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: (totalCents / 100).toFixed(2),
      currency: 'USD',
      metadata: {
        orderId: opts.orderId,
        skus: items.map((i) => i.sku),
        itemDesc: items.map((i) => i.name).join(', ').slice(0, 500),
        // Collected on our own checkout form before this call — see
        // create-btcpay-invoice.mts — rather than relying on BTCPay's
        // optional "requires refund email" checkout prompt, whose exact
        // field name/behavior has changed across BTCPay versions. This way
        // delivery never depends on guessing that correctly.
        buyerEmail: opts.buyerEmail,
      },
      checkout: {
        // Lightning only, per how this store is set up — see BTCPAY_SETUP.md
        // for the exact wording BTCPay's UI uses for this field, since it has
        // changed across BTCPay versions and is worth confirming against
        // your instance's actual API docs (Swagger, under /swagger) rather
        // than trusting this string blindly.
        paymentMethods: ['BTC-LightningNetwork'],
        redirectURL: `${opts.origin}/order-confirmation?checkout=success&btcpay_invoice={InvoiceId}`,
        redirectAutomatically: true,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BTCPay invoice creation failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const invoice = (await res.json()) as { id: string; checkoutLink: string }
  return { id: invoice.id, checkoutLink: invoice.checkoutLink }
}

export interface BTCPayInvoiceStatus {
  id: string
  status: string // "New" | "Processing" | "Settled" | "Expired" | "Invalid"
  metadata: { orderId?: string; skus?: string[]; buyerEmail?: string }
  amount: string
  currency: string
}

export async function getInvoice(invoiceId: string): Promise<BTCPayInvoiceStatus> {
  const { baseUrl, apiKey, storeId } = requireConfig()
  const res = await fetch(`${baseUrl}/api/v1/stores/${storeId}/invoices/${invoiceId}`, {
    headers: { Authorization: `token ${apiKey}` },
  })
  if (!res.ok) throw new Error(`BTCPay invoice lookup failed (${res.status})`)
  return (await res.json()) as BTCPayInvoiceStatus
}

/**
 * Verify a webhook request actually came from your BTCPay instance. BTCPay
 * signs the raw body with HMAC-SHA256 using the webhook's signing secret and
 * sends it as `BTCPay-Sig: sha256=<hex>` — same shape as Stripe's signature
 * header, verified the same constant-time way, for the same reason: a body
 * comparison alone leaks timing information an attacker can exploit.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = (process.env.BTCPAY_WEBHOOK_SECRET ?? '').trim()
  if (!secret || !signatureHeader) return false

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader.trim())
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
