// Regenerates netlify/lib/meridian-host-source.mts from the real package source.
//
// Run this after changing anything in meridian-host/:
//
//   node meridian-host/tools/embed-source.mjs
//
// Same reasoning as packages/incident-postmortem-automation/tools/embed-source.mjs
// (and every other product's equivalent script): the storefront delivers
// digital goods as a single document assembled at checkout, so a source-code
// product's payload has to be the actual files, embedded rather than read
// from disk at request time — deterministic delivery, no filesystem, no
// network, no failure mode at purchase.
//
// meridian-host/ sits directly at the repo root (not under packages/, unlike
// every other source product) because Meridian Host predates that
// convention and multicontainer/laptop.sh users already reference it at
// this path — REPO_ROOT below is one level up, not two.
//
// This is what closes AI-HOST-001's real gap: the product existed and
// worked, it just had no ARCHIVES entry in netlify/lib/product-archive.mts,
// so /api/download 404'd for every paying customer.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'meridian-host-source.mts')

// Flat layout, no subdirectories — every real file in the package, in the
// order a buyer should read them. `tools/` (this script) is excluded: it's
// the seller's build step, not part of what a buyer receives.
const INCLUDE_FILES = [
  'OWN.txt',
  'STEPS.txt',
  'MONEY.txt',
  'multinicheai',
  '_lib.sh',
  'from-github.sh',
  'firewall.sh',
  'laptop.sh',
  'bootstrap.sh',
  'forward.sh',
  'share.sh',
  'install.sh',
  'uninstall.sh',
  'run.sh',
  'shop.service',
  'container.env.example',
]

function collect() {
  const files = []
  for (const name of INCLUDE_FILES) {
    const full = join(PACKAGE_DIR, name)
    // Always emit POSIX separators so the generated module is identical on any OS.
    const rel = relative(PACKAGE_DIR, full).split(sep).join('/')
    files.push({ path: rel, contents: readFileSync(full, 'utf8') })
  }
  return files
}

/**
 * Render the module. Values go through JSON.stringify so no escaping hazard —
 * backticks, ${...}, and backslashes in the source cannot break the output.
 */
export function renderModule(files) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT BY HAND.',
    '//',
    '// Produced by meridian-host/tools/embed-source.mjs from the real package',
    '// source. Regenerate after changing anything in meridian-host/:',
    '//',
    '//   node meridian-host/tools/embed-source.mjs',
    '//',
    '// This is the payload for Meridian Host (SKU AI-HOST-001): the complete,',
    '// runnable source the buyer receives at checkout. It is embedded rather',
    '// than read from disk so fulfilment cannot fail on a missing file.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const MERIDIAN_HOST_SOURCE: SourceFile[] = [',
  ]

  for (const file of files) {
    lines.push('  {')
    lines.push(`    path: ${JSON.stringify(file.path)},`)
    lines.push(`    contents: ${JSON.stringify(file.contents)},`)
    lines.push('  },')
  }

  lines.push(']')
  lines.push('')
  return lines.join('\n')
}

export { collect }

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const files = collect()
  const module = renderModule(files)
  writeFileSync(OUTPUT, module)
  const bytes = files.reduce((sum, f) => sum + f.contents.length, 0)
  process.stdout.write(`Wrote ${relative(REPO_ROOT, OUTPUT)} — ${files.length} files, ${bytes} bytes of source\n`)
}
