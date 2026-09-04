// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests for MultiVault v2's MCP mode. Run with: node test/mcp.test.mjs
//
// The MCP server test drives a REAL @modelcontextprotocol/sdk Client against
// the REAL createMultiVaultServer(), connected over the SDK's own in-memory
// linked-pair transport — not a hand-rolled mock of the protocol. This is
// the same client/server code path an actual MCP host (Claude Desktop,
// Claude Code) exercises; only the transport (in-memory vs. real stdio) and
// the client (the SDK's Client vs. a host application) differ.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { initVault, buildLiveContext } from '../lib/vault.mjs'
import { createMultiVaultServer } from '../lib/mcp-server.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

// ---------------------------------------------------------------------------
// buildLiveContext — the no-passphrase, always-fresh path MCP mode relies on
// ---------------------------------------------------------------------------

test('buildLiveContext reflects the CURRENT folder state, not a stale snapshot', () => {
  const watchedDir = tempDir('live-watch')
  const vaultDest = tempDir('live-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'first version')
    initVault(vaultDest, { folder: watchedDir }) // no sync — deliberately never synced

    const { text: before } = buildLiveContext(vaultDest)
    assert.ok(before.includes('a.md'))
    assert.ok(before.includes('first version'))

    // Change the folder AFTER init, with no `vault sync` in between.
    writeFileSync(join(watchedDir, 'b.md'), 'a second file appeared')
    const { text: after } = buildLiveContext(vaultDest)
    assert.ok(after.includes('b.md'), 'a file added after init should appear without a sync step')
    assert.ok(after.includes('a second file appeared'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('buildLiveContext requires no passphrase at all', () => {
  const watchedDir = tempDir('live-watch')
  const vaultDest = tempDir('live-dest')
  try {
    initVault(vaultDest, { folder: watchedDir }) // passphrase is generated and discarded here
    // No passphrase captured, none passed below — this must still work.
    const { snapshot } = buildLiveContext(vaultDest, { format: 'json' })
    assert.equal(snapshot.files.length, 0) // empty folder, but no error
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('buildLiveContext fails clearly when no vault has been initialized', () => {
  const emptyDest = tempDir('never-init')
  try {
    assert.throws(() => buildLiveContext(emptyDest), /Run "vault init" first/)
  } finally {
    rmSync(emptyDest, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// MCP server — real Client, real Server, real (in-memory) transport
// ---------------------------------------------------------------------------

async function connectedClient(dest) {
  const server = createMultiVaultServer(dest)
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, server }
}

test('MCP: tools/list exposes get_context and vault_status', async () => {
  const vaultDest = tempDir('mcp-dest')
  try {
    initVault(vaultDest, { folder: null })
    const { client } = await connectedClient(vaultDest)
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    assert.deepEqual(names, ['get_context', 'vault_status'])
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context returns live folder contents through the real protocol round-trip', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    writeFileSync(join(watchedDir, 'notes.md'), 'Client prefers async updates.')
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const result = await client.callTool({ name: 'get_context', arguments: {} })
    assert.equal(result.isError, undefined)
    const text = result.content[0].text
    assert.ok(text.includes('notes.md'))
    assert.ok(text.includes('Client prefers async updates.'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context picks up a file added AFTER the client connected (no restart needed)', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const firstResult = await client.callTool({ name: 'get_context', arguments: {} })
    assert.ok(!firstResult.content[0].text.includes('late.txt'))

    writeFileSync(join(watchedDir, 'late.txt'), 'added after the MCP session started')
    const secondResult = await client.callTool({ name: 'get_context', arguments: {} })
    assert.ok(secondResult.content[0].text.includes('late.txt'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context respects the format argument (json)', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    writeFileSync(join(watchedDir, 'x.md'), 'hello')
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const result = await client.callTool({ name: 'get_context', arguments: { format: 'json' } })
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.files[0].relPath, 'x.md')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: vault_status reports configured folder without needing a passphrase', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)
    const result = await client.callTool({ name: 'vault_status', arguments: {} })
    assert.ok(result.content[0].text.includes(watchedDir))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context on a never-initialized vault returns isError, not a crash', async () => {
  const emptyDest = tempDir('mcp-never-init')
  try {
    // Deliberately skip initVault — createMultiVaultServer + callTool must
    // still respond cleanly rather than throwing out of the MCP transport.
    const { client } = await connectedClient(emptyDest)
    const result = await client.callTool({ name: 'get_context', arguments: {} })
    assert.equal(result.isError, true)
    assert.ok(result.content[0].text.includes('vault init'))
  } finally {
    rmSync(emptyDest, { recursive: true, force: true })
  }
})
