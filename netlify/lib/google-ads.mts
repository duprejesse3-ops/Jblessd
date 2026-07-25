import type Stripe from 'stripe'

const required = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
  'GOOGLE_ADS_CONVERSION_ACTION_ID',
] as const

function configured(): boolean {
  return required.every((name) => Boolean(process.env[name]?.trim()))
}

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

function conversionDateTime(created: number): string {
  return new Date(created * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00:00')
}

async function accessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
  if (!response.ok) throw new Error(`OAuth token request failed (${response.status})`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('OAuth token response had no access token')
  return data.access_token
}

export async function uploadGoogleAdsPurchase(session: Stripe.Checkout.Session): Promise<void> {
  if (!configured() || session.payment_status !== 'paid') return
  const clickId = String(session.metadata?.ad_click_id ?? '').trim()
  if (!clickId) return

  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID!)
  const actionId = digits(process.env.GOOGLE_ADS_CONVERSION_ACTION_ID!)
  if (!customerId || !actionId) return

  const clickSource = String(session.metadata?.ad_click_source || 'gclid').toLowerCase()
  const conversion: Record<string, unknown> = {
    conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
    conversionDateTime: conversionDateTime(session.created),
    conversionValue: (session.amount_total ?? 0) / 100,
    currencyCode: (session.currency ?? 'usd').toUpperCase(),
    orderId: session.id,
  }
  const consent = String(session.metadata?.ad_user_data_consent || 'unknown')
  if (consent === 'granted' || consent === 'denied') {
    const status = consent === 'granted' ? 'GRANTED' : 'DENIED'
    conversion.consent = { adUserData: status, adPersonalization: status }
  }
  if (clickSource === 'gbraid') conversion.gbraid = clickId
  else if (clickSource === 'wbraid') conversion.wbraid = clickId
  else conversion.gclid = clickId

  const token = await accessToken()
  const apiVersion = (process.env.GOOGLE_ADS_API_VERSION || 'v25').trim()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type': 'application/json',
  }
  const loginCustomerId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '')
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId

  const response = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}:uploadClickConversions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversions: [conversion], partialFailure: true }),
    },
  )
  if (!response.ok) throw new Error(`Google Ads conversion upload failed (${response.status})`)
  const result = await response.json() as { partialFailureError?: { message?: string } }
  if (result.partialFailureError?.message) throw new Error(`Google Ads rejected conversion: ${result.partialFailureError.message}`)
}
