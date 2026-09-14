#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { loadConfig, saveConfig, addRule, removeRule, defaultConfigPath } from '../lib/config.mjs'
import { createGateServer } from '../lib/proxy.mjs'
import { appendEvent, recentEntries, verifyChain, defaultLogPath } from '../lib/chain.mjs'

const args = process.argv.slice(2)
const command = args[0]

function flag(name) {
  const idx = args.indexOf(`--${name}`)
  return idx === -1 ? undefined : args[idx + 1]
}

function usage() {
  process.stdout.write(`Meridian Gate — outbound AI call proxy. Default is no.

Usage:
  gate start [--port 8899]                       Start the proxy.
  gate allow <host> --by <name> [--note "..."]    Add a host to the allowlist.
  gate deny <host>                                Remove a host from the allowlist.
  gate list                                       Show the current allowlist.
  gate log [--limit 50]                           Show recent witness-log entries.
  gate verify                                     Verify the witness log's hash chain.

Config: ${defaultConfigPath()}
Log:    ${defaultLogPath()}
`)
}

async function main() {
  switch (command) {
    case 'start': {
      const config = loadConfig()
      const port = Number(flag('port')) || config.port
      const server = createGateServer()
      server.listen(port, () => {
        appendEvent({ action: 'start', detail: `listening on :${port}` })
        process.stdout.write(`Meridian Gate listening on 127.0.0.1:${port}. Default is no — only allowlisted hosts pass.\n`)
        process.stdout.write(`Point HTTPS_PROXY=http://127.0.0.1:${port} at your AI tooling.\n`)
      })
      const shutdown = () => {
        appendEvent({ action: 'stop', detail: null })
        server.close(() => process.exit(0))
      }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
      break
    }

    case 'allow': {
      const host = args[1]
      const by = flag('by')
      const note = flag('note') ?? null
      if (!host || !by) {
        process.stderr.write('Usage: gate allow <host> --by <name> [--note "..."]\n')
        process.exitCode = 1
        return
      }
      const config = addRule(loadConfig(), { host, addedBy: by, note })
      saveConfig(config)
      appendEvent({ action: 'rule-add', host: host.toLowerCase(), by, detail: note })
      process.stdout.write(`Allowed ${host.toLowerCase()} — added by ${by}.\n`)
      break
    }

    case 'deny': {
      const host = args[1]
      if (!host) {
        process.stderr.write('Usage: gate deny <host>\n')
        process.exitCode = 1
        return
      }
      const config = removeRule(loadConfig(), host)
      saveConfig(config)
      appendEvent({ action: 'rule-remove', host: host.toLowerCase(), detail: null })
      process.stdout.write(`Removed ${host.toLowerCase()} from the allowlist. It is blocked again by default.\n`)
      break
    }

    case 'list': {
      const config = loadConfig()
      if (config.rules.length === 0) {
        process.stdout.write('No hosts allowed. Everything outbound is blocked. That is the default.\n')
        return
      }
      for (const r of config.rules) {
        process.stdout.write(`${r.host}  (allowed by ${r.addedBy} on ${r.addedAt}${r.note ? ` — ${r.note}` : ''})\n`)
      }
      break
    }

    case 'log': {
      const limit = Number(flag('limit')) || 50
      const entries = recentEntries(undefined, limit)
      if (entries.length === 0) {
        process.stdout.write('No witness-log entries yet.\n')
        return
      }
      for (const e of entries) {
        const who = e.by ? ` by ${e.by}` : ''
        const host = e.host ? ` ${e.host}` : ''
        process.stdout.write(`#${e.seq} ${e.at} ${e.action}${host}${who}\n`)
      }
      break
    }

    case 'verify': {
      const result = verifyChain()
      if (result.valid) {
        process.stdout.write(`Chain intact — ${result.totalEntries} entries, unbroken from genesis.\n`)
      } else {
        process.stderr.write(`Chain BROKEN at entry ${result.brokenAtSeq}: ${result.reason}\n`)
        process.exitCode = 1
      }
      break
    }

    default:
      usage()
      process.exitCode = command ? 1 : 0
  }
}

main()
