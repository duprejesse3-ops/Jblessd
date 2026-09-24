// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { addRoute, listRoutes, removeRoute, postToRoute, RouteError } from '../lib/routes.mjs'
import { loadConfig } from '../lib/config.mjs'

function tempConfig() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcd-routes-'))
  const configPath = path.join(dir, 'bridge.config.json')
  const config = loadConfig(configPath)
  return { config, configPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('addRoute requires a name and at least one webhook URL', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    assert.throws(() => addRoute(config, { slackWebhookUrl: 'https://x' }, configPath), RouteError)
    assert.throws(() => addRoute(config, { name: 'ops' }, configPath), RouteError)
  } finally {
    cleanup()
  }
})

test('addRoute succeeds and persists to disk', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops-alerts', slackWebhookUrl: 'https://hooks.slack.com/x' }, configPath)
    assert.equal(route.name, 'ops-alerts')
    assert.equal(listRoutes(config).length, 1)

    const reloaded = loadConfig(configPath)
    assert.equal(reloaded.routes.length, 1)
    assert.equal(reloaded.routes[0].name, 'ops-alerts')
  } finally {
    cleanup()
  }
})

test('removeRoute deletes an existing route and throws on an unknown one', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops', slackWebhookUrl: 'https://x' }, configPath)
    removeRoute(config, route.id, configPath)
    assert.equal(listRoutes(config).length, 0)
    assert.throws(() => removeRoute(config, 'nonexistent', configPath), RouteError)
  } finally {
    cleanup()
  }
})

test('postToRoute refuses in read-only mode without calling either platform client', async () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops', slackWebhookUrl: 'https://x', discordWebhookUrl: 'https://y' }, configPath)
    config.safeMode = 'read-only'
    let called = false
    const slackPost = async () => { called = true; return { ok: true } }
    const discordPost = async () => { called = true; return { ok: true } }
    await assert.rejects(
      () => postToRoute(config, route.id, 'hello', { slackPost, discordPost }),
      (err) => err instanceof RouteError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
  } finally {
    cleanup()
  }
})

test('postToRoute posts to both platforms when both are configured, in read-write mode', async () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops', slackWebhookUrl: 'https://slack.x', discordWebhookUrl: 'https://discord.x' }, configPath)
    config.safeMode = 'read-write'
    const slackCalls = []
    const discordCalls = []
    const slackPost = async (url, text) => { slackCalls.push({ url, text }); return { ok: true } }
    const discordPost = async (url, content) => { discordCalls.push({ url, content }); return { ok: true } }

    const result = await postToRoute(config, route.id, 'Deploy finished', { slackPost, discordPost })
    assert.equal(slackCalls.length, 1)
    assert.equal(discordCalls.length, 1)
    assert.equal(slackCalls[0].text, 'Deploy finished')
    assert.equal(discordCalls[0].content, 'Deploy finished')
    assert.ok(result.slack.ok && result.discord.ok)
  } finally {
    cleanup()
  }
})

test('postToRoute only posts to the platform(s) actually configured on that route', async () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'slack-only', slackWebhookUrl: 'https://slack.x' }, configPath)
    config.safeMode = 'read-write'
    let discordCalled = false
    const slackPost = async () => ({ ok: true })
    const discordPost = async () => { discordCalled = true; return { ok: true } }

    const result = await postToRoute(config, route.id, 'hi', { slackPost, discordPost })
    assert.equal(discordCalled, false)
    assert.equal(result.discord, null)
  } finally {
    cleanup()
  }
})

test('postToRoute throws for an unknown route id', async () => {
  const { config, cleanup } = tempConfig()
  try {
    config.safeMode = 'read-write'
    await assert.rejects(() => postToRoute(config, 'nonexistent', 'hi'), RouteError)
  } finally {
    cleanup()
  }
})
