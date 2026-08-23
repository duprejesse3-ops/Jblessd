#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Command-line runner.
//
// The "no third party" answer for a messy folder: a Node script that sorts
// files into categorized folders. No account, no API key required, nothing
// phoning home by default — runs on a laptop, a scheduled task, a cron job,
// or launchd. See ../adapters for hands-off scheduling.
//
// Safety: --dry-run is the DEFAULT. Nothing moves until you pass --apply.
// This mirrors the audit agent's exit-code discipline, adapted to a tool that
// mutates the filesystem rather than just reporting on one.
//
// Exit codes:
//   0  ran successfully (dry-run showed a plan, or --apply moved files)
//   1  ran, but one or more files failed to move (permissions, etc.)
//   2  could not run at all (bad usage, folder not found)

import process from 'node:process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { planFolder, applyPlan, summarizePlan, DEFAULTS } from '../lib/organize.mjs'
import { classifyWithAI } from '../lib/ai.mjs'

const USAGE = `file-organizer-agent — sort a messy folder into categorized subfolders

Usage
  organize [folder] [options]

  If [folder] is omitted, defaults to your Downloads folder.

Options
  --apply                 Actually move files (default: dry-run, plan only)
  --dest <folder>         Where organized files go (default: <folder>/Organized)
  --min-age <minutes>     Skip files newer than this, in case something's still
                           downloading (default: ${DEFAULTS.minAgeMinutes})
  --ai                    Use AI to classify files the rules can't place
                           (requires ANTHROPIC_API_KEY; sends filenames only,
                           never file contents)
  --format <text|json>    Output format (default: text)
  -h, --help               Show this message
  -v, --version            Show the engine version

Examples
  organize                          # plan for ~/Downloads, dry-run
  organize ~/Desktop --apply        # actually sort the Desktop
  organize ~/Downloads --ai --apply # use AI for anything the rules miss
  organize . --dest ~/Sorted --apply
`

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { apply: false, dest: null, minAgeMinutes: DEFAULTS.minAgeMinutes, ai: false, format: 'text', folder: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') { process.stdout.write(USAGE); process.exit(0) }
    if (arg === '-v' || arg === '--version') { process.stdout.write('file-organizer-agent 1.0.0\n'); process.exit(0) }
    if (arg === '--apply') { opts.apply = true; continue }
    if (arg === '--ai') { opts.ai = true; continue }
    if (arg === '--dest') { opts.dest = argv[++i]; continue }
    if (arg === '--min-age') { opts.minAgeMinutes = Number(argv[++i]); continue }
    if (arg === '--format') { opts.format = argv[++i]; continue }
    if (arg.startsWith('--')) throw new UsageError(`Unknown option: ${arg}`)
    if (!opts.folder) { opts.folder = arg; continue }
    throw new UsageError(`Unexpected argument: ${arg}`)
  }
  return opts
}

function defaultDownloadsFolder() {
  // Downloads lives at ~/Downloads on macOS, Linux, and Windows alike.
  return join(homedir(), 'Downloads')
}

function printTextSummary(plan, applied) {
  if (!plan.length) {
    process.stdout.write('Nothing to organize — folder is empty or every file is too new.\n')
    return
  }
  const groups = summarizePlan(plan)
  for (const [category, files] of groups) {
    process.stdout.write(`\n${category} (${files.length})\n`)
    for (const f of files) process.stdout.write(`  ${f}\n`)
  }
  const aiCount = plan.filter((p) => p.source === 'ai').length
  process.stdout.write(`\n${plan.length} file(s) planned`)
  if (aiCount) process.stdout.write(`, ${aiCount} classified by AI`)
  process.stdout.write(applied ? ' — moved.\n' : ' — dry run, nothing moved. Pass --apply to move them.\n')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const folder = resolve(opts.folder ?? defaultDownloadsFolder())

  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    process.stderr.write(`Folder not found: ${folder}\n`)
    process.exit(2)
  }

  const planOpts = {
    minAgeMinutes: opts.minAgeMinutes,
    destRoot: opts.dest ? resolve(opts.dest) : undefined,
    classifyUnplaced: opts.ai ? classifyWithAI : undefined,
  }

  const plan = await planFolder(folder, planOpts)
  const results = opts.apply ? applyPlan(plan) : plan.map((p) => ({ ...p, ok: true }))
  const failed = results.filter((r) => !r.ok)

  if (opts.format === 'json') {
    process.stdout.write(JSON.stringify({ folder, applied: opts.apply, results }, null, 2) + '\n')
  } else {
    printTextSummary(plan, opts.apply)
    if (failed.length) {
      process.stdout.write(`\n${failed.length} file(s) failed to move:\n`)
      for (const f of failed) process.stdout.write(`  ${f.file}: ${f.error}\n`)
    }
  }

  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  if (err instanceof UsageError) {
    process.stderr.write(`${err.message}\n\n${USAGE}`)
    process.exit(2)
  }
  process.stderr.write(`Unexpected error: ${err.message}\n`)
  process.exit(2)
})
