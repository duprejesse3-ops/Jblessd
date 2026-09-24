// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Google OAuth2, plain REST — no `googleapis` SDK (a genuinely large
// dependency for what two endpoints actually need). Two things happen here:
//
//   1. ONE-TIME setup (`docs-bridge auth`): the standard "installed
//      application" OAuth flow — open a consent URL, Google redirects back
//      to a short-lived local HTTP server with an authorization code, that
//      code is exchanged for a refresh token. You do this exactly once, by
//      hand, in a browser. The refresh token is what you save and reuse.
//   2. EVERY SYNC RUN: exchange the saved refresh token for a short-lived
//      access token. No browser, no human, safe to run from cron/launchd/
//      Task Scheduler — this is what makes ongoing syncs unattended.
//
// A Google Cloud OAuth client (Client ID + Secret) is unavoidable for any
// real Drive integration — that's Google's requirement, not a design choice
// made here. README's "One-time setup" section walks through creating one.

import { createServer } from 'node:http'
import { URL } from 'node:url'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly' // read-only — this tool only ever exports, never modifies or deletes anything in Drive

/**
 * Run the one-time interactive authorization flow. Opens (prints) a consent
 * URL, starts a short-lived local server on `port` to catch Google's
 * redirect, and exchanges the resulting code for tokens.
 *
 * @returns {Promise<{ refreshToken: string, accessToken: string, expiresAt: number }>}
 */
export async function runAuthFlow({ clientId, clientSecret, port = 53682, onReady }) {
  const redirectUri = `http://127.0.0.1:${port}/oauth/callback`
  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline') // required to get a refresh_token, not just a short-lived access token
  authUrl.searchParams.set('prompt', 'consent') // forces a refresh_token even on a re-auth, where Google otherwise sometimes omits it

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, redirectUri)
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404)
        return res.end()
      }
      const err = url.searchParams.get('error')
      const authCode = url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        err
          ? `<html><body style="font-family:sans-serif">Authorization failed: ${err}. Close this tab and try again.</body></html>`
          : `<html><body style="font-family:sans-serif">Authorized — you can close this tab and return to your terminal.</body></html>`,
      )
      server.close()
      if (err) reject(new Error(`Google denied authorization: ${err}`))
      else if (!authCode) reject(new Error('No authorization code returned.'))
      else resolve(authCode)
    })
    server.on('error', reject)
    // Only announce the URL once the redirect target actually exists —
    // opening it a moment too early (before listen()'s callback fires) would
    // race a fast browser against a server that isn't accepting connections
    // yet.
    server.listen(port, () => onReady?.(authUrl.toString()))
  })

  return exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri })
}

async function exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Token exchange failed: ${data.error_description ?? data.error ?? res.status}`)
  if (!data.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. This usually means you already authorized this app before — ' +
        'revoke access at https://myaccount.google.com/permissions and run "docs-bridge auth" again.',
    )
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
}

/**
 * Exchange a saved refresh token for a fresh access token. Called at the
 * start of every sync run — access tokens are short-lived (~1hr) by design,
 * refresh tokens are the long-lived credential actually saved to disk.
 */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      `Access token refresh failed: ${data.error_description ?? data.error ?? res.status}. ` +
        `If this persists, the refresh token may have been revoked — run "docs-bridge auth" again.`,
    )
  }
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
}

export function authUrlForDisplay({ clientId, port = 53682 }) {
  const redirectUri = `http://127.0.0.1:${port}/oauth/callback`
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}
