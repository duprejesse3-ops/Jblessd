// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.
//
// Verifies the JWT construction and signature directly (using a throwaway
// test keypair — never used against real Google infrastructure), plus the
// token exchange against a local fixture server standing in for Google's
// token endpoint. No real Google account or network access required.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { createVerify, createPrivateKey, createPublicKey } from 'node:crypto'
import { buildAssertion, getAccessToken, TOKEN_URL, SCOPE } from '../lib/google-auth.mjs'

// A throwaway 2048-bit RSA test keypair, generated solely for this test
// suite. It has never been registered with Google and is not used for
// anything outside verifying that buildAssertion() signs correctly.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCvtxoJDlXzpKU4
r3fwnnHlEoM/Px/mF4Ijq4vz2h9GDFfNxvhxLm+1UtZNIPUnt/ElgcH2OBiBMB9K
b+i1JwWO59GWnbOSKge7GOZRS1s98gNgVgYlocmpdUxKsMkiJPpujRP0b8V7wLqy
iOnJ/SFUuxXrwC8u7PQb17nRdWqO19eB95bBTcZXWHzLO7Ky86RUbVoo2XaoeaaU
tsXulJcUfH11pdYLr4NOD4Nj0pIFIAv9NrRt1j7P9VFOP+0HQJvfMx8SI4nX9n+t
WnaRdIfgCJgI6UpOTnzn8NgFGg2XqCzJeABbwWLCQtCtFroC4c4cP/kC4AYdOn+V
Zf20L2GXAgMBAAECggEAG4jAIiomatLidwL78u8JHuGrQlZka7xETs2bVR9ZZjMZ
8StcE/Q4Wfv8i8J91/b5aSyvlaMNp/S/+nyVxQkz1ERcMdNNZ7qBUp6gvJ1n00mg
oNBqDyyOeqjgRxXzto9/1KHzvgpjsjQtrTtKEzZAqlPUqAgJ/Lrxt4ky23EgPPiw
Cs6WGBBix0rqQrzYiqoSYUzUirBTlhE3L7DNLONQNCEQ9UOvSpKdKCLGQzeNHogp
WLnFJV4w0sRDy2iET9TJmliRym43vWQxxhuwzT3U3qkErC4R3Xt7YCIv/QLKkwZx
u7y1bv1g6Rv+Mt9AnFAKugkpLACiXPM2Sk+it4N9jQKBgQDddUmX/0GlMt3qEtMf
iXBq0DAHUx7AqvROn7WAymf8tDoQeyaUyg3IGAWpwlnT5A9YJWelNUEaJR96SCpU
Cg6N5J8uWL9s02yIY+AhG+foEAhYoULAHRtm7B0OPKXZ4RkMRDMXMn93s1VkOmyx
OAfD8EfnkFLTHFUzUEAcPOTc9QKBgQDLH1KflBSPIjfNORXLObNcIe4UsD2aGSvR
9TrIYivA0RPlIvblduF3iYyzYO/trXdcHG7m9WSKfNDQvNAK4JNTdnqo5MQR9Zib
bnwRjnYy1tJViUKaAgB5BT+jEIoMp70jVTvoTwQS6ARWYJrdsJ+bafSsOPW2yMSc
cEaMZRNs2wKBgQCP03OXXrUAmDedpNou2jEDffAjYa1QTfba9UiIu2urqFUpjQGy
kkM/F7Ld3JZAUhZRFgHpPtvoIgH+hc3PxLRNHRTwoby47drH/a17c0c65Oa2wQy7
/mtkfaYlL+g6x8FfwQ85WpeEYxjrPjKHKi+I5o2ca5QO/ZCsAcuRS08L3QKBgQC9
60qYtJ9IeakNNMvg2dGPWpY+N89RbymexZkx1UCtp4/flgKd6LrFxxGMgx2y8JeC
w38aaeWY6z1ffrtTAEogJs5nboa5eBY5dmOBEuAHhv7hRVbFowuIHFU1BXjeflQF
XmOGQaNAfjnX/bmvgL6rVLWV9iggwLW8w+niyXsRMwKBgQDJU5SbK4RdUWz6UTlx
nLy99rtUZojCoQNjoVnKhzBuRp9kLWJJZUp5Qp7HCR0jTLmk4ZWs5PM6+NS7igz1
/agZPmDtVdHC1xdonhPD18sUnHpFuho+n6RRNdCn/mQu2M8t+M5FmZDjMuwIb6I+
CGOFMAI5MOzD91nb1n9JS6DG8g==
-----END PRIVATE KEY-----`

test('buildAssertion produces a well-formed, correctly signed JWT', () => {
  const now = 1_700_000_000
  const jwt = buildAssertion('bot@my-project.iam.gserviceaccount.com', TEST_PRIVATE_KEY, now)
  const parts = jwt.split('.')
  assert.equal(parts.length, 3, 'JWT must have header.claims.signature')

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  assert.deepEqual(header, { alg: 'RS256', typ: 'JWT' })

  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  assert.equal(claims.iss, 'bot@my-project.iam.gserviceaccount.com')
  assert.equal(claims.scope, SCOPE)
  assert.equal(claims.aud, TOKEN_URL)
  assert.equal(claims.iat, now)
  assert.equal(claims.exp, now + 3600)
})

test('buildAssertion signature verifies against the matching public key', () => {
  const jwt = buildAssertion('bot@my-project.iam.gserviceaccount.com', TEST_PRIVATE_KEY)
  const [headerB64, claimsB64, sigB64] = jwt.split('.')
  const signedInput = `${headerB64}.${claimsB64}`
  const signature = Buffer.from(sigB64, 'base64url')

  // Derive the real public key from the private key rather than trusting a
  // separately-pasted one, so this test can't silently drift out of sync.
  const pub = createPublicKey(createPrivateKey(TEST_PRIVATE_KEY))

  const verifier = createVerify('RSA-SHA256')
  verifier.update(signedInput)
  verifier.end()
  assert.equal(verifier.verify(pub, signature), true)
})

test('buildAssertion normalizes an escaped-newline private key', () => {
  const escaped = TEST_PRIVATE_KEY.replace(/\n/g, '\\n')
  // Should not throw — the escaped form is what a service-account JSON key
  // looks like when pasted into a single-line config field.
  assert.doesNotThrow(() => buildAssertion('bot@x.iam.gserviceaccount.com', escaped))
})

test('getAccessToken exchanges the assertion at the token endpoint', async () => {
  let received
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      received = new URLSearchParams(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'fake-access-token', expires_in: 3600 }))
    })
  })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const port = server.address().port
    const { accessToken, expiresIn } = await getAccessToken('bot@x.iam.gserviceaccount.com', TEST_PRIVATE_KEY, {
      tokenUrl: `http://localhost:${port}/token`,
    })
    assert.equal(accessToken, 'fake-access-token')
    assert.equal(expiresIn, 3600)
    assert.equal(received.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')
    assert.ok(received.get('assertion'))
  } finally {
    server.close()
  }
})

test('getAccessToken throws a clear error on a failed exchange', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(401, { 'content-type': 'text/plain' })
    res.end('invalid_grant')
  })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const port = server.address().port
    await assert.rejects(
      () => getAccessToken('bot@x.iam.gserviceaccount.com', TEST_PRIVATE_KEY, { tokenUrl: `http://localhost:${port}/token` }),
      /token exchange failed/,
    )
  } finally {
    server.close()
  }
})
