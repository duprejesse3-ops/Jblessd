#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Command-line runner.
//
// This is the "no third party" answer in its simplest form: a Node script that
// takes a URL and prints a report. No account, no API key, no service to sign up
// for, nothing phoning home. It runs on a laptop, a Raspberry Pi, a VPS cron job,
// a CI runner, or a Netlify scheduled function — see ../adapters.
//
// Exit codes are chosen so this is usable as a build gate:
//   0  audit ran, nothing at or above the --fail-on threshold
//   1  audit ran, problems found at or above the threshold
//   2  could not run at all (bad usage, unsafe URL, engine crash)

import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { auditSite, DEFAULTS } from '../lib/audit.mjs'
import { toJson, toMarkdown, toText } from '../lib/report.mjs'
import { UnsafeUrlError } from '../lib/url-safety.mjs'

const USAGE = `site-audit-agent — audit any website from your own machine

Usage
  audit <url> [options]

Options
  --format <text|json|markdown>  Output format (default: text)
  --out <file>                   Write the report to a file instead of stdout
  --max-pages <n>                Internal pages to crawl (default: ${DEFAULTS.maxPages})
  --concurrency <n>              Parallel requests while crawling (default: ${DEFAULTS.concurrency})
  --timeout <ms>                 Per-request timeout (default: ${DEFAULTS.timeoutMs})
  --slow <ms>                    Homepage latency that counts as slow (default: ${DEFAULTS.slowMs})
  --user-agent <string>          User-Agent to send
  --allow-private                Permit localhost / private IPs (for a dev server)
  --fail-on <failed|warning|never>
                                 Exit 1 when the audit reaches this severity
                                 (default: failed)
  -h, --help                     Show this message
  -v, --version                  Show the engine version

Examples
  audit example.com
  audit https://example.com --format markdown --out audit.md
  audit http://localhost:8080 --allow-private --max-pages 5
  audit example.com --fail-on warning        # strict CI gate
`

const NUMERIC = {
  '--max-pages': 'maxPages',
  '--concurrency': 'concurrency',
  '--timeout': 'timeoutMs',
  '--slow': 'slowMs',
}

class UsageError extends Error {}

function parseArgs(argv) {
  const options = {}
  let target = null
  let format = 'text'
  let out = null
  let failOn = 'failed'

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value.`)
      i += 1
      return value
    }

    if (arg === '-h' || arg === '--help') return { help: true }
    if (arg === '-v' || arg === '--version') return { version: true }

    if (arg === '--allow-private') {
      options.allowPrivate = true
    } else if (arg === '--format') {
      format = next()
      if (!['text', 'json', 'markdown'].includes(format)) {
        throw new UsageError(`Unknown format "${format}". Use text, json or markdown.`)
      }
    } else if (arg === '--out') {
      out = next()
    } else if (arg === '--fail-on') {
      failOn = next()
      if (!['failed', 'warning', 'never'].includes(failOn)) {
        throw new UsageError(`Unknown --fail-on value "${failOn}". Use failed, warning or never.`)
      }
    } else if (arg === '--user-agent') {
      options.userAgent = next()
    } else if (NUMERIC[arg]) {
      const value = Number(next())
      if (!Number.isFinite(value) || value <= 0) throw new UsageError(`${arg} must be a positive number.`)
      options[NUMERIC[arg]] = value
    } else if (arg.startsWith('-')) {
      throw new UsageError(`Unknown option "${arg}".`)
    } else if (target === null) {
      target = arg
    } else {
      throw new UsageError('Audit one URL at a time.')
    }
  }

  if (!target) throw new UsageError('No URL given.')
  return { target, options, format, out, failOn }
}

/** Whether the report trips the configured gate. */
function shouldFail(report, failOn) {
  if (failOn === 'never') return false
  if (failOn === 'warning') return report.status !== 'healthy'
  return report.status === 'unhealthy'
}

function render(report, format, colorize) {
  if (format === 'json') return toJson(report)
  if (format === 'markdown') return toMarkdown(report)
  return toText(report, { color: colorize })
}

async function main() {
  let parsed
  try {
    parsed = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`)
    return 2
  }

  if (parsed.help) {
    process.stdout.write(USAGE)
    return 0
  }
  if (parsed.version) {
    process.stdout.write('site-audit-agent 1.0.0\n')
    return 0
  }

  const { target, options, format, out, failOn } = parsed

  let report
  try {
    report = await auditSite(target, options)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      process.stderr.write(`${error.message}\n`)
      return 2
    }
    process.stderr.write(`Audit failed: ${error?.message ?? error}\n`)
    return 2
  }

  // Colour only when writing to a terminal — never into a file or a CI log.
  const output = render(report, format, out === null && process.stdout.isTTY === true)

  if (out) {
    try {
      writeFileSync(out, output.endsWith('\n') ? output : `${output}\n`)
    } catch (error) {
      process.stderr.write(`Could not write ${out}: ${error.message}\n`)
      return 2
    }
    process.stderr.write(`Score ${report.score}/100 · ${report.status} · ${report.summary}\nWrote ${out}\n`)
  } else {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)
  }

  return shouldFail(report, failOn) ? 1 : 0
}

process.exitCode = await main()
