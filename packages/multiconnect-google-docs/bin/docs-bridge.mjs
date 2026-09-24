#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A local, one-way bridge: exports Google Docs as real .md files on disk, so
// tools that only read local files (like MultiVault, sold separately) can
// see content that otherwise only exists in Google Docs.
//
// Deliberately narrow: this reads Docs from Drive and writes local files.
// It never writes back to Drive, never touches Sheets/Slides/other file
// types, and never talks to any AI model. What happens to the exported
// files afterward — indexing, watching, anything else — is a different
// tool's job.
//
// Subcommands:
//   docs-bridge auth                          One-time interactive OAuth setup
//   docs-bridge sync   [--dest <path>] [--folder-id <id>] [--config <path>]
//   docs-bridge status [--config <path>]

import process from 'node:process'
import { resolve } from 'node:path'
import { runAuthFlow } from '../lib/auth.mjs'
import { syncDocs } from '../lib/sync.mjs'
import { saveConfig, loadConfig, defaultConfigPath } from '../lib/config.mjs'

const USAGE = `docs-bridge — export Google Docs to local markdown files

Usage
  docs-bridge <command> [options]

Commands
  auth      One-time interactive setup: authorize with Google, save a refresh token
  sync      Export changed/new Docs to local .md files
  status    Show what's configured, without printing the refresh token

Options
  --dest <path>       Where to write exported .md files (sync: required unless saved during auth)
  --folder-id <id>    Only export Docs inside this one Drive folder (optional — omit for the whole Drive)
  --config <path>     Where credentials are stored (default: ~/.multivault-docs-bridge/config.json)
  --client-id <id>    Google OAuth Client ID (auth: required unless already saved)
  --client-secret <s> Google OAuth Client Secret (auth: required unless already saved)
  -h, --help          Show this message
  -v, --version       Show the version

Setup (one-time, see README for the full walkthrough):
  1. Create a Google Cloud project, enable the Drive API, create an OAuth
     Client ID (type: Desktop app).
  2. docs-bridge auth --client-id <id> --client-secret <secret>
  3. docs-bridge sync --dest ~/Documents/ClientVault

Then schedule step 3 with one of the adapters in adapters/ (cron, launchd,
Windows Task Scheduler) — same pattern as MultiVault's own scheduling.
`

class UsageError extends Error {}

function parseArgs(argv) {
  const command = argv[0]
  const opts = { dest: null, folderId: null, config: null, clientId: null, clientSecret: null }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      process.stdout.write(USAGE)
      process.exit(0)
    }
    if (arg === '-v' || arg === '--version') {
      process.stdout.write('multivault-docs-bridge 1.0.0\n')
      process.exit(0)
    }
    if (arg === '--dest') { opts.dest = argv[++i]; continue }
    if (arg === '--folder-id') { opts.folderId = argv[++i]; continue }
    if (arg === '--config') { opts.config = argv[++i]; continue }
    if (arg === '--client-id') { opts.clientId = argv[++i]; continue }
    if (arg === '--client-secret') { opts.clientSecret = argv[++i]; continue }
    throw new UsageError(`Unknown option: ${arg}`)
  }
  return { command, opts }
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE)
    process.exit(0)
  }
  const { command, opts } = parseArgs(argv)
  const configPath = opts.config ? resolve(opts.config) : defaultConfigPath()

  if (command === 'auth') {
    const existing = loadConfig(configPath) ?? {}
    const clientId = opts.clientId ?? existing.clientId
    const clientSecret = opts.clientSecret ?? existing.clientSecret
    if (!clientId || !clientSecret) {
      throw new UsageError('--client-id and --client-secret are required the first time you run "docs-bridge auth". See README for how to create them.')
    }
    process.stdout.write('Starting Google authorization...\n\n')
    const { refreshToken } = await runAuthFlow({
      clientId,
      clientSecret,
      onReady: (url) => {
        process.stdout.write(`Open this URL in a browser and sign in:\n\n  ${url}\n\n`)
        process.stdout.write('Waiting for you to finish in the browser...\n')
      },
    })
    saveConfig({ ...existing, clientId, clientSecret, refreshToken }, configPath)
    process.stdout.write(`\nAuthorized. Saved to ${configPath}.\n`)
    process.stdout.write('Run "docs-bridge sync --dest <folder>" next.\n')
    return
  }

  if (command === 'sync') {
    const config = loadConfig(configPath)
    if (!config) {
      throw new UsageError('Not authorized yet. Run "docs-bridge auth" first.')
    }
    const dest = opts.dest ? resolve(opts.dest) : config.dest
    if (!dest) {
      throw new UsageError('No destination folder. Pass --dest, or it will be remembered after your first sync with --dest.')
    }
    const folderId = opts.folderId ?? config.folderId
    const result = await syncDocs({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      dest,
      folderId,
    })
    // Remember dest/folderId for next time, so a scheduled run doesn't need
    // the flags repeated in every cron/launchd/Task Scheduler entry.
    saveConfig({ ...config, dest, folderId: folderId ?? null }, configPath)

    process.stdout.write(
      `Synced: ${result.exported} exported, ${result.unchanged} unchanged, ${result.removed} removed.\n`,
    )
    if (result.errors.length) {
      process.stdout.write(`${result.errors.length} doc(s) failed to export:\n`)
      for (const e of result.errors) process.stdout.write(`  - ${e.name}: ${e.message}\n`)
      process.exitCode = 1
    }
    return
  }

  if (command === 'status') {
    const config = loadConfig(configPath)
    if (!config) {
      process.stdout.write(`Not configured yet (${configPath} does not exist). Run "docs-bridge auth" first.\n`)
      return
    }
    process.stdout.write(
      [
        `Config: ${configPath}`,
        `Client ID: ${config.clientId}`,
        `Destination: ${config.dest ?? '(not set — will be required on first sync)'}`,
        `Drive folder scope: ${config.folderId ?? '(none — exports from the whole Drive)'}`,
        `Refresh token: ${config.refreshToken ? 'present' : 'MISSING — run "docs-bridge auth"'}`,
      ].join('\n') + '\n',
    )
    return
  }

  throw new UsageError(`Unknown command: ${command}`)
}

main().catch((err) => {
  if (err instanceof UsageError) {
    process.stderr.write(`${err.message}\n\n${USAGE}`)
    process.exit(2)
  }
  process.stderr.write(`${err.message}\n`)
  process.exit(1)
})
