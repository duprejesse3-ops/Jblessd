// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two halves: posting to a Discord webhook (outbound), and verifying the
// Ed25519 signature Discord attaches to interaction requests — slash
// commands (inbound). Discord signs "{timestamp}{raw body}" with Ed25519
// and sends X-Signature-Ed25519 / X-Signature-Timestamp headers, verified
// against the app's public key. See
// https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization.

import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

const REQUEST_TIMEOUT_MS = 10_000

export class DiscordApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'DiscordApiError'
    this.status = status
  }
}

/**
 * Post a message to a Discord webhook URL.
 * @param {string} webhookUrl
 * @param {string} content
 */
export async function postToDiscord(webhookUrl, content) {
  if (!webhookUrl) throw new DiscordApiError('No Discord webhook URL configured for this route.', 0)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.text().catch(() => '')
      throw new DiscordApiError(`Discord webhook ${res.status}: ${body.slice(0, 300)}`, res.status)
    }
    return { ok: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verify a Discord interaction request's Ed25519 signature.
 * @param {string} rawBody the exact, unparsed request body
 * @param {string} signatureHex the X-Signature-Ed25519 header (hex-encoded)
 * @param {string} timestampHeader the X-Signature-Timestamp header
 * @param {string} publicKeyHex the app's public key from the Discord dev portal (hex-encoded)
 */
export function verifyDiscordSignature(rawBody, signatureHex, timestampHeader, publicKeyHex) {
  if (!publicKeyHex || !signatureHex || !timestampHeader) return false
  try {
    const message = Buffer.from(timestampHeader + rawBody, 'utf8')
    const signature = Buffer.from(signatureHex, 'hex')
    // Node's Ed25519 keys are DER/PEM-wrapped; Discord gives a raw 32-byte
    // public key as hex, so it has to be wrapped in the standard SPKI
    // header for Ed25519 before node:crypto will accept it.
    const rawKey = Buffer.from(publicKeyHex, 'hex')
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const der = Buffer.concat([spkiPrefix, rawKey])
    const publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' })
    return cryptoVerify(null, message, publicKey, signature)
  } catch {
    return false
  }
}
