// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac, generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { verifySlackSignature } from '../lib/slack-client.mjs'
import { verifyDiscordSignature } from '../lib/discord-client.mjs'

// ---- Slack (HMAC-SHA256) ----

function slackSign(body, secret, timestamp) {
  const base = `v0:${timestamp}:${body}`
  return 'v0=' + createHmac('sha256', secret).update(base, 'utf8').digest('hex')
}

test('verifySlackSignature accepts a correctly signed request', () => {
  const now = 1_700_000_000
  const body = 'command=%2Fstatus&text=hello'
  const secret = 'slack-signing-secret'
  const signature = slackSign(body, secret, String(now))
  assert.equal(verifySlackSignature(body, String(now), signature, secret, now), true)
})

test('verifySlackSignature rejects a signature from the wrong secret', () => {
  const now = 1_700_000_000
  const body = 'command=%2Fstatus'
  const signature = slackSign(body, 'wrong-secret', String(now))
  assert.equal(verifySlackSignature(body, String(now), signature, 'real-secret', now), false)
})

test('verifySlackSignature rejects a tampered body', () => {
  const now = 1_700_000_000
  const secret = 'slack-signing-secret'
  const signature = slackSign('command=%2Fstatus', secret, String(now))
  assert.equal(verifySlackSignature('command=%2Fother', String(now), signature, secret, now), false)
})

test('verifySlackSignature rejects a request outside the timestamp window (replay protection)', () => {
  const originalTime = 1_700_000_000
  const secret = 'slack-signing-secret'
  const body = 'command=%2Fstatus'
  const signature = slackSign(body, secret, String(originalTime))
  const tenMinutesLater = originalTime + 600
  assert.equal(verifySlackSignature(body, String(originalTime), signature, secret, tenMinutesLater), false)
})

test('verifySlackSignature rejects when secret or headers are missing', () => {
  assert.equal(verifySlackSignature('body', '123', 'v0=abc', ''), false)
  assert.equal(verifySlackSignature('body', '', 'v0=abc', 'secret'), false)
  assert.equal(verifySlackSignature('body', '123', '', 'secret'), false)
})

// ---- Discord (Ed25519) ----

function discordKeypairHex() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex')
  return { privateKey, publicKeyHex }
}

function discordSign(privateKey, timestamp, body) {
  const message = Buffer.from(timestamp + body, 'utf8')
  return cryptoSign(null, message, privateKey).toString('hex')
}

test('verifyDiscordSignature accepts a correctly signed request', () => {
  const { privateKey, publicKeyHex } = discordKeypairHex()
  const timestamp = '1700000000'
  const body = JSON.stringify({ type: 1 })
  const signature = discordSign(privateKey, timestamp, body)
  assert.equal(verifyDiscordSignature(body, signature, timestamp, publicKeyHex), true)
})

test('verifyDiscordSignature rejects a signature from a different keypair', () => {
  const { privateKey } = discordKeypairHex()
  const { publicKeyHex: wrongPublicKey } = discordKeypairHex()
  const timestamp = '1700000000'
  const body = JSON.stringify({ type: 1 })
  const signature = discordSign(privateKey, timestamp, body)
  assert.equal(verifyDiscordSignature(body, signature, timestamp, wrongPublicKey), false)
})

test('verifyDiscordSignature rejects a tampered body', () => {
  const { privateKey, publicKeyHex } = discordKeypairHex()
  const timestamp = '1700000000'
  const signature = discordSign(privateKey, timestamp, JSON.stringify({ type: 1 }))
  assert.equal(verifyDiscordSignature(JSON.stringify({ type: 2 }), signature, timestamp, publicKeyHex), false)
})

test('verifyDiscordSignature rejects when a header or key is missing', () => {
  assert.equal(verifyDiscordSignature('body', '', '123', 'key'), false)
  assert.equal(verifyDiscordSignature('body', 'ab', '', 'key'), false)
  assert.equal(verifyDiscordSignature('body', 'ab', '123', ''), false)
})

test('verifyDiscordSignature never throws on malformed hex input', () => {
  assert.doesNotThrow(() => verifyDiscordSignature('body', 'not-hex!!', '123', 'also-not-hex'))
  assert.equal(verifyDiscordSignature('body', 'not-hex!!', '123', 'also-not-hex'), false)
})
