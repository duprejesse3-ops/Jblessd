// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { addConnector, listConnectors, removeConnector, RegistryError } from '../lib/registry.mjs'
import { loadConfig } from '../lib/config.mjs'

function tempConfig() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcg-registry-'))
  const configPath = path.join(dir, 'guard.config.json')
  const config = loadConfig(configPath)
  return { config, configPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('addConnector requires a name, base URL, and token', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    assert.throws(() => addConnector(config, { baseUrl: 'http://x', token: 't' }, configPath), RegistryError)
    assert.throws(() => addConnector(config, { name: 'x', token: 't' }, configPath), RegistryError)
    assert.throws(() => addConnector(config, { name: 'x', baseUrl: 'http://x' }, configPath), RegistryError)
  } finally {
    cleanup()
  }
})

test('addConnector strips a trailing slash from the base URL', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const connector = addConnector(config, { name: 'Shopify', baseUrl: 'http://localhost:8421/', token: 't' }, configPath)
    assert.equal(connector.baseUrl, 'http://localhost:8421')
  } finally {
    cleanup()
  }
})

test('addConnector persists to disk', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    addConnector(config, { name: 'Shopify', baseUrl: 'http://localhost:8421', token: 't' }, configPath)
    const reloaded = loadConfig(configPath)
    assert.equal(reloaded.connectors.length, 1)
    assert.equal(reloaded.connectors[0].name, 'Shopify')
  } finally {
    cleanup()
  }
})

test('removeConnector deletes an existing connector and throws on an unknown one', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const connector = addConnector(config, { name: 'x', baseUrl: 'http://x', token: 't' }, configPath)
    removeConnector(config, connector.id, configPath)
    assert.equal(listConnectors(config).length, 0)
    assert.throws(() => removeConnector(config, 'nonexistent', configPath), RegistryError)
  } finally {
    cleanup()
  }
})
