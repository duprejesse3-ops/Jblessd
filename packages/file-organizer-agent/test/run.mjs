// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Test suite. Run with: npm test   (or: node test/run.mjs)
//
// Uses node:test and node:assert — both built in, so the package still
// installs nothing. Every test creates a real temporary directory with real
// files and runs the engine against it, then cleans up — no mocked
// filesystem, so what passes here is what will actually happen on a buyer's
// machine.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync, existsSync, utimesSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyByRules, scanFolder, planFolder, applyPlan, summarizePlan } from '../lib/organize.mjs'

/** A fresh temp dir with the given files created inside it (empty contents is fine). */
function makeFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'organize-test-'))
  for (const name of files) writeFileSync(join(dir, name), 'x')
  return dir
}

/** Back-date a file's mtime, to test the "too fresh, skip it" guard. */
function touchAge(path, minutesAgo) {
  const t = new Date(Date.now() - minutesAgo * 60_000)
  utimesSync(path, t, t)
}

// ---------------------------------------------------------------------------
// rule classification
// ---------------------------------------------------------------------------

test('classifies common file types by extension', () => {
  assert.equal(classifyByRules('report.pdf'), 'Documents')
  assert.equal(classifyByRules('photo.jpg'), 'Images')
  assert.equal(classifyByRules('budget.xlsx'), 'Spreadsheets')
  assert.equal(classifyByRules('song.mp3'), 'Audio')
  assert.equal(classifyByRules('movie.mp4'), 'Video')
  assert.equal(classifyByRules('archive.zip'), 'Archives')
  assert.equal(classifyByRules('setup.exe'), 'Installers')
})

test('keyword rules win over plain extension', () => {
  // A .pdf would normally be Documents, but "invoice" in the name should
  // route it to the more useful bucket instead.
  assert.equal(classifyByRules('invoice-march-2026.pdf'), 'Invoices & Receipts')
  assert.equal(classifyByRules('receipt_amazon.pdf'), 'Invoices & Receipts')
  assert.equal(classifyByRules('Screenshot 2026-08-23 at 10.14.png'), 'Screenshots')
  assert.equal(classifyByRules('bank-statement-july.pdf'), 'Statements')
  assert.equal(classifyByRules('vendor-contract-final.docx'), 'Contracts')
})

test('keyword matching is case-insensitive', () => {
  assert.equal(classifyByRules('INVOICE_2026.pdf'), 'Invoices & Receipts')
})

test('returns null for anything the rules cannot place', () => {
  assert.equal(classifyByRules('mystery.xyz'), null)
  assert.equal(classifyByRules('noextension'), null)
})

// ---------------------------------------------------------------------------
// scanning
// ---------------------------------------------------------------------------

test('scanFolder lists files but skips dotfiles', () => {
  const dir = makeFixture(['a.pdf', 'b.jpg', '.DS_Store'])
  try {
    const files = scanFolder(dir, { minAgeMinutes: 0 })
    const names = files.map((f) => f.name).sort()
    assert.deepEqual(names, ['a.pdf', 'b.jpg'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scanFolder skips files newer than minAgeMinutes', () => {
  const dir = makeFixture(['fresh.pdf', 'old.pdf'])
  try {
    touchAge(join(dir, 'old.pdf'), 10) // 10 minutes old
    // fresh.pdf keeps its just-created mtime (effectively 0 minutes old)
    const files = scanFolder(dir, { minAgeMinutes: 2 })
    assert.deepEqual(files.map((f) => f.name), ['old.pdf'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// planning — never touches the filesystem
// ---------------------------------------------------------------------------

test('planFolder builds a plan without moving anything', async () => {
  const dir = makeFixture(['invoice-1.pdf', 'photo.png'])
  try {
    const plan = await planFolder(dir, { minAgeMinutes: 0 })
    assert.equal(plan.length, 2)
    // Still exactly where they started — planning must be a pure read.
    assert.ok(existsSync(join(dir, 'invoice-1.pdf')))
    assert.ok(existsSync(join(dir, 'photo.png')))

    const invoice = plan.find((p) => p.file === 'invoice-1.pdf')
    assert.equal(invoice.category, 'Invoices & Receipts')
    assert.equal(invoice.source, 'rules')

    const photo = plan.find((p) => p.file === 'photo.png')
    assert.equal(photo.category, 'Images')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('unrecognized files fall back to Other when no AI classifier is given', async () => {
  const dir = makeFixture(['mystery.xyz'])
  try {
    const plan = await planFolder(dir, { minAgeMinutes: 0 })
    assert.equal(plan[0].category, 'Other')
    assert.equal(plan[0].source, 'fallback')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a supplied classifyUnplaced callback is used for files rules cannot place', async () => {
  const dir = makeFixture(['mystery.xyz'])
  try {
    const plan = await planFolder(dir, {
      minAgeMinutes: 0,
      classifyUnplaced: async () => 'Documents',
    })
    assert.equal(plan[0].category, 'Documents')
    assert.equal(plan[0].source, 'ai')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// applying — the only step that mutates the filesystem
// ---------------------------------------------------------------------------

test('applyPlan actually moves files into category subfolders', async () => {
  const dir = makeFixture(['invoice-1.pdf', 'photo.png'])
  try {
    const plan = await planFolder(dir, { minAgeMinutes: 0 })
    const results = applyPlan(plan)

    assert.ok(results.every((r) => r.ok))
    assert.ok(!existsSync(join(dir, 'invoice-1.pdf')), 'original should be gone')
    assert.ok(existsSync(join(dir, 'Organized', 'Invoices & Receipts', 'invoice-1.pdf')))
    assert.ok(existsSync(join(dir, 'Organized', 'Images', 'photo.png')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a naming collision gets a numbered suffix instead of overwriting', async () => {
  const dir = makeFixture(['photo.png'])
  try {
    // Pre-create the destination the first move will target, so the engine
    // has to route around an existing file.
    const destDir = join(dir, 'Organized', 'Images')
    const { mkdirSync, writeFileSync: write } = await import('node:fs')
    mkdirSync(destDir, { recursive: true })
    write(join(destDir, 'photo.png'), 'already here')

    const plan = await planFolder(dir, { minAgeMinutes: 0 })
    assert.equal(plan[0].to, join(destDir, 'photo (2).png'))

    applyPlan(plan)
    assert.ok(existsSync(join(destDir, 'photo.png')), 'original file untouched')
    assert.ok(existsSync(join(destDir, 'photo (2).png')), 'new file got a suffix')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a failed move is reported, not thrown', () => {
  const plan = [{ file: 'ghost.pdf', from: '/nonexistent/ghost.pdf', to: '/nonexistent/dest/ghost.pdf', category: 'Documents', source: 'rules' }]
  const results = applyPlan(plan)
  assert.equal(results[0].ok, false)
  assert.ok(results[0].error)
})

// ---------------------------------------------------------------------------
// summarizing
// ---------------------------------------------------------------------------

test('summarizePlan groups files by category', () => {
  const plan = [
    { file: 'a.pdf', category: 'Documents' },
    { file: 'b.pdf', category: 'Documents' },
    { file: 'c.jpg', category: 'Images' },
  ]
  const groups = summarizePlan(plan)
  assert.deepEqual(groups.get('Documents'), ['a.pdf', 'b.pdf'])
  assert.deepEqual(groups.get('Images'), ['c.jpg'])
})
