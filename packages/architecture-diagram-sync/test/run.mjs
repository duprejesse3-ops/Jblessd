// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanRepo } from '../lib/scan.mjs'
import { draftDiagram } from '../lib/diagram.mjs'
import { writeDiagram } from '../lib/write.mjs'

let failures = 0
async function test(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.error(`not ok - ${name}`)
    console.error(`  ${err.message}`)
  }
}

function buildFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'diagram-sync-test-'))
  mkdirSync(join(root, 'lib'), { recursive: true })
  mkdirSync(join(root, 'api'), { recursive: true })
  writeFileSync(join(root, 'lib', 'core.mjs'), 'export const x = 1\n')
  writeFileSync(join(root, 'api', 'handler.mjs'), "import { x } from '../lib/core.mjs'\nexport default x\n")
  writeFileSync(join(root, 'Dockerfile'), 'FROM node:20\n')
  return root
}

await test('scanRepo finds real top-level dirs and a real cross-dir import edge', () => {
  const root = buildFixtureRepo()
  try {
    const scan = scanRepo(root)
    assert.deepEqual(scan.topLevelDirs, ['api', 'lib'])
    assert.equal(scan.fileCounts.api, 1)
    assert.equal(scan.fileCounts.lib, 1)
    const edge = scan.crossDirImports.find((e) => e.from === 'api' && e.to === 'lib')
    assert.ok(edge, 'expected an api -> lib import edge')
    assert.ok(scan.infra.includes('Dockerfile'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

await test('draftDiagram rejects a missing API key', async () => {
  await assert.rejects(
    () => draftDiagram({ topLevelDirs: [], fileCounts: {}, crossDirImports: [], infra: [] }, { apiKey: '' }),
    /ANTHROPIC_API_KEY/,
  )
})

await test('writeDiagram reports changed on first write, unchanged on identical rewrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-sync-write-'))
  const path = join(dir, 'docs', 'architecture.md')
  const draft = { mermaid: 'flowchart TD\n  a --> b', notes: 'test' }
  try {
    const first = writeDiagram(path, draft)
    assert.equal(first, true)
    const second = writeDiagram(path, draft)
    assert.equal(second, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
