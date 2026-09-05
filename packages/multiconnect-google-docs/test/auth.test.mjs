// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests the local OAuth callback server for real — it's our own code, not
// Google's, so there's no reason to mock it. A real HTTP request is sent to
// the real running server to simulate what Google's browser redirect would
// do. Only the actual token-exchange call TO Google is mocked, since that's
// the one genuinely external dependency.

import assert from 'node:assert/strict'
import test from 'node:test'
import { runAuthFlow } from '../lib/auth.mjs'

const realFetch = globalThis.fetch

function installFetchMock(handler) {
  globalThis.fetch = async (url, opts) => handler(String(url), opts)
  return () => {
    globalThis.fetch = realFetch
  }
}

test('runAuthFlow: a real request to the callback URL with a code resolves with tokens', async () => {
  const restore = installFetchMock(async () => ({
    ok: true,
    json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }),
  }))
  const port = 53701
  try {
    const flowPromise = runAuthFlow({
      clientId: 'client',
      clientSecret: 'secret',
      port,
      onReady: async (url) => {
        assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'))
        // Simulate Google's browser redirect: a real HTTP GET to our real running server.
        await realFetch(`http://127.0.0.1:${port}/oauth/callback?code=real-auth-code`)
      },
    })
    const result = await flowPromise
    assert.equal(result.refreshToken, 'r')
    assert.equal(result.accessToken, 'a')
  } finally {
    restore()
  }
})

test('runAuthFlow: a real request carrying an error param rejects with a clear message', async () => {
  const port = 53702
  const flowPromise = runAuthFlow({
    clientId: 'client',
    clientSecret: 'secret',
    port,
    onReady: async (url) => {
      await realFetch(`http://127.0.0.1:${port}/oauth/callback?error=access_denied`)
    },
  })
  await assert.rejects(flowPromise, /access_denied/)
})

test('runAuthFlow: a request to an unrelated path on the callback server 404s without affecting the flow', async () => {
  const port = 53703
  const restore = installFetchMock(async () => ({
    ok: true,
    json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }),
  }))
  try {
    const flowPromise = runAuthFlow({
      clientId: 'client',
      clientSecret: 'secret',
      port,
      onReady: async () => {
        const res = await realFetch(`http://127.0.0.1:${port}/some/other/path`)
        assert.equal(res.status, 404)
        // The real callback still needs to arrive for the flow to resolve.
        await realFetch(`http://127.0.0.1:${port}/oauth/callback?code=xyz`)
      },
    })
    const result = await flowPromise
    assert.equal(result.refreshToken, 'r')
  } finally {
    restore()
  }
})
