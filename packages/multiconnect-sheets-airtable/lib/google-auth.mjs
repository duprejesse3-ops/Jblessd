// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Google's Sheets API needs an OAuth2 access token, and a server-to-server
// tool gets one via a signed JWT exchanged at Google's token endpoint — the
// standard "service account" flow. The official googleapis package pulls in
// a large dependency tree for this one step, so this reimplements just the
// JWT construction and signing (RS256, via node:crypto) plus the token
// exchange call, keeping the whole package at zero dependencies.

import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_LIFETIME_SEC = 3600

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build and sign the JWT assertion Google's token endpoint expects.
 * @param {string} serviceAccountEmail
 * @param {string} privateKey PEM-formatted private key from the service account JSON
 * @param {number} [now] unix seconds, injectable for tests
 */
export function buildAssertion(serviceAccountEmail, privateKey, now = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: serviceAccountEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_LIFETIME_SEC,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  // Normalize a private key that arrived with literal "\n" sequences (common
  // when it's pasted from a JSON file into a single-line config field).
  const key = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey
  const signature = signer.sign(key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${unsigned}.${signature}`
}

/**
 * Exchange a signed assertion for a bearer access token.
 * @param {string} serviceAccountEmail
 * @param {string} privateKey
 * @param {{ fetchImpl?: typeof fetch, tokenUrl?: string }} [opts] injectable for tests
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function getAccessToken(serviceAccountEmail, privateKey, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const tokenUrl = opts.tokenUrl ?? TOKEN_URL
  const assertion = buildAssertion(serviceAccountEmail, privateKey)
  const res = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

export { TOKEN_URL, SCOPE }
