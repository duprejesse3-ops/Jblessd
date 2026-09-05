#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Command-line runner for MultiVault.
//
// A local, encrypted snapshot of one folder (and, optionally, one .ics
// calendar file) that you can turn into a short context brief — paste it
// into any AI chat, or pipe it into an API call — instead of re-explaining
// your situation every time. No account, no OAuth, no cloud storage, nothing
// phoning home: the vault file lives on your machine and only your
// passphrase can open it.
//
// Subcommands:
//   vault init    [--folder <path>] [--ics <path>] [--dest <path>]
//   vault sync    [--dest <path>]
//   vault context [--dest <path>] [--format text|markdown|json]
//   vault status  [--dest <path>]
//
// Exit codes:
//   0  ran successfully
//   1  ran, but the passphrase was wrong or the vault could not be decrypted
//   2  could not run at all (bad usage, no vault found, folder not found)

import process from 'node:process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initVault, syncVault, buildContext, buildLiveContext, ensureIndex, statusVault, DecryptError } from '../lib/vault.mjs'
import { startWatcher } from '../lib/watcher.mjs'

const USAGE = `multivault — a local, encrypted context snapshot of a folder and calendar,
with a BM25-ranked search index for large folders

Usage
  vault <command> [options]

Commands
  init      Create a new vault (generates and prints your passphrase — save it!)
  sync      Re-scan the folder/calendar and refresh the encrypted snapshot
  index     Build/update the search index once, without decrypting or printing anything
  watch     Keep the search index continuously updated in the background (Ctrl+C to stop)
  context   Print a context brief — whole-folder, or ranked search results with --query
  status    Show last-sync time and counts, without needing the passphrase

Options
  --folder <path>    Folder to watch (init: required unless already set; sync/index: overrides)
  --ics <path>       Path to a .ics calendar file to include (optional)
  --dest <path>      Where the vault lives (default: ./.multivault)
  --query <text>     context: search instead of dumping the whole folder — no passphrase needed
  --topk <n>         context --query: max results (default 8)
  --format <fmt>     context: text|markdown (default) or json
  --passphrase <p>   Passphrase (or set MULTIVAULT_PASSPHRASE — preferred, keeps it
                      out of your shell history). Not needed for context --query.
  -h, --help          Show this message
  -v, --version       Show the version

Examples
  vault init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
  vault sync                                     # whole-folder mode: snapshot + encrypt
  vault context                                  # paste this into a chat
  vault index                                    # pre-warm the search index (optional — auto-builds on first query)
  vault context --query "invoice overdue"        # ranked search, no passphrase needed
  vault context --format json | your-script      # pipe into your own tooling
  MULTIVAULT_PASSPHRASE=xxxx vault sync          # for cron/launchd/Task Scheduler
`

class UsageError extends Error {}

function defaultDest() {
  return join(process.cwd(), '.multivault')
}

function parseArgs(argv) {
  const command = argv[0]
  const opts = { folder: null, ics: null, dest: null, format: 'markdown', passphrase: null, query: null, topK: null }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') { process.stdout.write(USAGE); process.exit(0) }
    if (arg === '-v' || arg === '--version') { process.stdout.write('multivault 3.0.0\n'); process.exit(0) }
    if (arg === '--folder') { opts.folder = argv[++i]; continue }
    if (arg === '--ics') { opts.ics = argv[++i]; continue }
    if (arg === '--dest') { opts.dest = argv[++i]; continue }
    if (arg === '--format') { opts.format = argv[++i]; continue }
    if (arg === '--passphrase') { opts.passphrase = argv[++i]; continue }
    if (arg === '--query') { opts.query = argv[++i]; continue }
    if (arg === '--topk') { opts.topK = Number(argv[++i]); continue }
    throw new UsageError(`Unknown option: ${arg}`)
  }
  return { command, opts }
}

function resolvePassphrase(opts) {
  const passphrase = opts.passphrase ?? process.env.MULTIVAULT_PASSPHRASE
  if (!passphrase) {
    throw new UsageError(
      'No passphrase given. Pass --passphrase, or set MULTIVAULT_PASSPHRASE (recommended for scheduled runs).',
    )
  }
  return passphrase
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE)
    process.exit(0)
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    process.stdout.write('multivault 3.0.0\n')
    process.exit(0)
  }
  const { command, opts } = parseArgs(argv)
  const dest = resolve(opts.dest ?? defaultDest())

  if (command === 'init') {
    const folder = opts.folder ? resolve(opts.folder) : null
    if (folder && (!existsSync(folder) || !statSync(folder).isDirectory())) {
      process.stderr.write(`Folder not found: ${folder}\n`)
      process.exit(2)
    }
    const ics = opts.ics ? resolve(opts.ics) : null
    const passphrase = initVault(dest, { folder, icsPath: ics })
    process.stdout.write(`Vault created at ${dest}\n\n`)
    process.stdout.write(`Your passphrase (shown once — save it now, e.g. in a password manager):\n\n`)
    process.stdout.write(`  ${passphrase}\n\n`)
    process.stdout.write(
      `There is no recovery if you lose this. It is never stored anywhere by this tool.\n` +
        `Run "vault sync" next to take your first snapshot, or "vault context --query ..." to search — that path builds its own index automatically and needs no passphrase.\n`,
    )
    return
  }

  if (command === 'sync') {
    const passphrase = resolvePassphrase(opts)
    const result = syncVault(dest, passphrase, {
      folder: opts.folder ? resolve(opts.folder) : undefined,
      icsPath: opts.ics ? resolve(opts.ics) : undefined,
    })
    process.stdout.write(
      `Synced: ${result.fileCount} file(s), ${result.eventCount} calendar event(s) at ${result.syncedAt}\n`,
    )
    return
  }

  if (command === 'index') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stderr.write(`No vault found at ${dest}. Run "vault init" first.\n`)
      process.exit(2)
    }
    const folder = opts.folder ? resolve(opts.folder) : meta.folder
    if (!folder) {
      process.stderr.write('No folder configured. Pass --folder, or set one at "vault init" time.\n')
      process.exit(2)
    }
    const index = ensureIndex(dest, folder)
    process.stdout.write(
      `Indexed: ${Object.keys(index.files).length} file(s), ${index.docs.length} searchable chunk(s) at ${index.builtAt}\n`,
    )
    return
  }

  if (command === 'watch') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stderr.write(`No vault found at ${dest}. Run "vault init" first.\n`)
      process.exit(2)
    }
    const folder = opts.folder ? resolve(opts.folder) : meta.folder
    if (!folder) {
      process.stderr.write('No folder configured. Pass --folder, or set one at "vault init" time.\n')
      process.exit(2)
    }
    process.stdout.write(`Watching ${folder} — index will stay current in the background. Ctrl+C to stop.\n`)
    const controller = startWatcher(dest, folder, {
      onUpdate: (result) => {
        const stamp = new Date().toISOString()
        process.stdout.write(`${stamp} re-indexed: +${result.added} ~${result.updated} -${result.removed}\n`)
      },
    })
    // Keep the process alive until Ctrl+C; stop() closes the underlying
    // fs.watch handles cleanly rather than leaving them dangling.
    process.on('SIGINT', () => {
      controller.stop()
      process.stdout.write('\nStopped.\n')
      process.exit(0)
    })
    await new Promise(() => {}) // run forever
    return
  }

  if (command === 'context') {
    const format = opts.format === 'json' ? 'json' : 'markdown'
    if (opts.query) {
      // Search mode: no passphrase needed — see buildLiveContext in
      // lib/vault.mjs for why (nothing decrypted, nothing at rest read).
      const { text } = buildLiveContext(dest, { query: opts.query, topK: opts.topK ?? undefined, format })
      process.stdout.write(text)
      return
    }
    const passphrase = resolvePassphrase(opts)
    process.stdout.write(buildContext(dest, passphrase, { format }))
    return
  }

  if (command === 'status') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stdout.write(`No vault found at ${dest}.\n`)
      process.exit(2)
    }
    process.stdout.write(JSON.stringify(meta, null, 2) + '\n')
    return
  }

  throw new UsageError(`Unknown command: ${command}`)
}

main().catch((err) => {
  if (err instanceof UsageError) {
    process.stderr.write(`${err.message}\n\n${USAGE}`)
    process.exit(2)
  }
  if (err instanceof DecryptError) {
    process.stderr.write(`${err.message}\n`)
    process.exit(1)
  }
  process.stderr.write(`${err.message}\n`)
  process.exit(2)
})
