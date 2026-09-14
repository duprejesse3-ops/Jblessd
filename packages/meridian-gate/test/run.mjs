// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { connect as netConnect } from 'node:net'
import { loadConfig, saveConfig, addRule, removeRule, findRule } from '../lib/config.mjs'
import { appendEvent, recentEntries, verifyChain, defaultLogPath } from '../lib/chain.mjs'
import { createGateServer, parseHostPort } from '../lib/proxy.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let failures = 0
async function test(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.error(`not ok - ${name}`)
    console.error(`  ${err.stack ?? err.message}`)
  }
}

function tmpDir() {
  return mkdtempSync(path.join(tmpdir(), 'meridian-gate-test-'))
}

// --- config.mjs ---

await test('a host with no rule is not found — default is no', () => {
  const config = loadConfig(path.join(tmpDir(), 'nope.json'))
  assert.equal(config.rules.length, 0)
  assert.equal(findRule(config, 'api.openai.com'), null)
})

await test('addRule requires a named human', () => {
  assert.throws(() => addRule({ port: 8899, rules: [] }, { host: 'api.openai.com' }), /named human/)
})

await test('addRule then findRule round-trips, host normalized to lowercase', () => {
  let config = { port: 8899, rules: [] }
  config = addRule(config, { host: 'API.OpenAI.com', addedBy: 'jesse' })
  const rule = findRule(config, 'api.openai.com')
  assert.ok(rule)
  assert.equal(rule.addedBy, 'jesse')
})

await test('addRule for an already-allowed host replaces the old rule, not duplicates it', () => {
  let config = { port: 8899, rules: [] }
  config = addRule(config, { host: 'api.openai.com', addedBy: 'jesse', note: 'first' })
  config = addRule(config, { host: 'api.openai.com', addedBy: 'jesse', note: 'second' })
  assert.equal(config.rules.length, 1)
  assert.equal(config.rules[0].note, 'second')
})

await test('removeRule drops the host and nothing else', () => {
  let config = { port: 8899, rules: [] }
  config = addRule(config, { host: 'api.openai.com', addedBy: 'jesse' })
  config = addRule(config, { host: 'api.anthropic.com', addedBy: 'jesse' })
  config = removeRule(config, 'api.openai.com')
  assert.equal(config.rules.length, 1)
  assert.equal(config.rules[0].host, 'api.anthropic.com')
})

await test('saveConfig then loadConfig round-trips through disk', () => {
  const dir = tmpDir()
  const configPath = path.join(dir, 'gate.config.json')
  let config = addRule({ port: 9000, rules: [] }, { host: 'api.anthropic.com', addedBy: 'jesse' })
  saveConfig(config, configPath)
  const loaded = loadConfig(configPath)
  assert.equal(loaded.port, 9000)
  assert.equal(loaded.rules[0].host, 'api.anthropic.com')
})

// --- chain.mjs ---

await test('appendEvent chains to genesis on an empty log', () => {
  const logPath = path.join(tmpDir(), 'gate.log.jsonl')
  const entry = appendEvent({ action: 'block', host: 'evil.example.com' }, logPath)
  assert.equal(entry.seq, 1)
  assert.equal(entry.prevHash, '0'.repeat(64))
})

await test('verifyChain is valid across a run of allow/block events', () => {
  const logPath = path.join(tmpDir(), 'gate.log.jsonl')
  appendEvent({ action: 'block', host: 'evil.example.com' }, logPath)
  appendEvent({ action: 'rule-add', host: 'api.anthropic.com', by: 'jesse' }, logPath)
  appendEvent({ action: 'allow', host: 'api.anthropic.com', by: 'jesse' }, logPath)
  const result = verifyChain(logPath)
  assert.equal(result.valid, true)
  assert.equal(result.totalEntries, 3)
})

await test('verifyChain catches a tampered entry', async () => {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const logPath = path.join(tmpDir(), 'gate.log.jsonl')
  appendEvent({ action: 'block', host: 'evil.example.com' }, logPath)
  appendEvent({ action: 'allow', host: 'api.anthropic.com', by: 'jesse' }, logPath)
  const lines = readFileSync(logPath, 'utf8').trim().split('\n')
  const tampered = JSON.parse(lines[0])
  tampered.host = 'not-actually-evil.example.com'
  lines[0] = JSON.stringify(tampered)
  writeFileSync(logPath, lines.join('\n') + '\n')
  const result = verifyChain(logPath)
  assert.equal(result.valid, false)
  assert.equal(result.brokenAtSeq, 1)
})

await test('recentEntries returns most-recent-first, respecting limit', () => {
  const logPath = path.join(tmpDir(), 'gate.log.jsonl')
  appendEvent({ action: 'block', host: 'a.example.com' }, logPath)
  appendEvent({ action: 'block', host: 'b.example.com' }, logPath)
  appendEvent({ action: 'block', host: 'c.example.com' }, logPath)
  const recent = recentEntries(logPath, 2)
  assert.equal(recent.length, 2)
  assert.equal(recent[0].host, 'c.example.com')
  assert.equal(recent[1].host, 'b.example.com')
})

// --- proxy.mjs ---

await test('parseHostPort splits host:port and falls back to default port', () => {
  assert.deepEqual(parseHostPort('api.openai.com:443', 443), { host: 'api.openai.com', port: 443 })
  assert.deepEqual(parseHostPort('api.openai.com', 443), { host: 'api.openai.com', port: 443 })
})

await test('CONNECT to a host with no rule is refused with 403, and logged as blocked', async () => {
  const dir = tmpDir()
  const configPath = path.join(dir, 'gate.config.json')
  const logPath = path.join(dir, 'gate.log.jsonl')
  saveConfig({ port: 0, rules: [] }, configPath)

  const server = createGateServer({ configPath, logPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()

  const response = await new Promise((resolve, reject) => {
    const socket = netConnect(port, '127.0.0.1', () => {
      socket.write('CONNECT evil.example.com:443 HTTP/1.1\r\nHost: evil.example.com:443\r\n\r\n')
    })
    let data = ''
    socket.on('data', (chunk) => {
      data += chunk.toString()
      socket.end()
    })
    socket.on('close', () => resolve(data))
    socket.on('error', reject)
  })

  assert.match(response, /403/)
  server.close()

  const entries = recentEntries(logPath, 10)
  assert.equal(entries[0].action, 'block')
  assert.equal(entries[0].host, 'evil.example.com')
})

await test('CONNECT to an allowed host gets a 200 and a real tunnel', async () => {
  const dir = tmpDir()
  const configPath = path.join(dir, 'gate.config.json')
  const logPath = path.join(dir, 'gate.log.jsonl')
  saveConfig(addRule({ port: 0, rules: [] }, { host: '127.0.0.1', addedBy: 'test' }), configPath)

  // A trivial "upstream" the tunnel should reach.
  const upstream = createServer((req, res) => res.end('hello through the tunnel'))
  await new Promise((resolve) => upstream.listen(0, resolve))
  const upstreamPort = upstream.address().port

  const server = createGateServer({ configPath, logPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()

  const response = await new Promise((resolve, reject) => {
    const socket = netConnect(port, '127.0.0.1', () => {
      socket.write(`CONNECT 127.0.0.1:${upstreamPort} HTTP/1.1\r\nHost: 127.0.0.1:${upstreamPort}\r\n\r\n`)
    })
    let data = ''
    let sentRequest = false
    socket.on('data', (chunk) => {
      data += chunk.toString()
      if (!sentRequest && data.includes('200 Connection Established')) {
        sentRequest = true
        socket.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:${upstreamPort}\r\nConnection: close\r\n\r\n`)
      }
      if (data.includes('hello through the tunnel')) {
        socket.end()
      }
    })
    socket.on('close', () => resolve(data))
    socket.on('error', reject)
  })

  assert.match(response, /200 Connection Established/)
  assert.match(response, /hello through the tunnel/)
  server.close()
  upstream.close()

  const entries = recentEntries(logPath, 10)
  assert.equal(entries[0].action, 'allow')
  assert.equal(entries[0].by, 'test')
})

// --- embed sync (delivery integrity) ---
//
// tools/ is the seller's build step and is deliberately not shipped to
// buyers (see tools/embed-source.mjs and package.json "files"). This check
// only runs in the seller's own checkout, where tools/ exists — a buyer's
// `npm test` skips it rather than failing on a file they were never given.

const HERE = dirname(fileURLToPath(import.meta.url))
const EMBED_TOOL = join(HERE, '..', 'tools', 'embed-source.mjs')

if (existsSync(EMBED_TOOL)) {
  await test('netlify/lib/meridian-gate-source.mts matches the real package source', async () => {
    const { collect, renderModule } = await import('../tools/embed-source.mjs')
    const REPO_ROOT = resolve(HERE, '..', '..', '..')
    const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'meridian-gate-source.mts')
    assert.ok(existsSync(OUTPUT), `${OUTPUT} does not exist — run: node packages/meridian-gate/tools/embed-source.mjs`)
    const expected = renderModule(collect())
    const actual = readFileSync(OUTPUT, 'utf8')
    assert.equal(actual, expected, 'Generated source module is stale — run: node packages/meridian-gate/tools/embed-source.mjs')
  })
} else {
  console.log('skip - embed sync check (tools/ not present in this copy — seller-only check)')
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`)
  process.exit(1)
} else {
  console.log('\nAll tests passed.')
}
