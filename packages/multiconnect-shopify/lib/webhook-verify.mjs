// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Shopify signs every webhook call with an HMAC-SHA256 of the raw request
// body, using your webhook secret, base64-encoded into the
// X-Shopify-Hmac-Sha256 header. Verifying it is the only thing standing
// between "a real event from your store" and "anyone on the internet who
// found this URL" — this module is that check, and nothing else in the
// package accepts a webhook without it passing first.

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * @param {string} rawBody the exact, unparsed request body bytes as a string
 * @param {string} signatureHeader the X-Shopify-Hmac-Sha256 header value
 * @param {string} secret your webhook signing secret
 * @returns {boolean}
 */
export function verifyShopifyWebhook(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const a = Buffer.from(computed)
  const b = Buffer.from(signatureHeader)
  // Constant-time comparison — a plain === here would leak timing
  // information about how many leading bytes matched, letting a patient
  // attacker forge a valid signature byte by byte.
  return a.length === b.length && timingSafeEqual(a, b)
}
