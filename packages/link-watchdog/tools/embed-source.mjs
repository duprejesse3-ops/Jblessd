// Regenerates netlify/lib/link-watchdog-source.mts from the real package source.
//
// Run this after changing anything in the package:
//
//   node packages/link-watchdog/tools/embed-source.mjs
//
// Same rationale as every other source-code product in this repo (see
// packages/supplier-po-sync/tools/embed-source.mjs): delivery has to be
// deterministic, with no filesystem/network dependency at purchase time.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'link-watchdog-source.mts')

const INCLUDE_DIRS = ['lib', 'bin', '.github-workflow-template', 'test']
const INCLUDE_FILES = ['README.md', 'LICENSE.md', 'package.json', '.env.example', 'config.example.json']

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function collect() {
  const paths = []
  for (const file of INCLUDE_FILES) paths.push(join(PACKAGE_DIR, file))
  for (const dir of INCLUDE_DIRS) paths.push(...walk(join(PACKAGE_DIR, dir)))

  const files = []
  for (const path of paths) {
    const rel = relative(PACKAGE_DIR, path).split(sep).join('/')
    files.push({ path: rel, contents: readFileSync(path, 'utf8') })
  }
  return files
}

export function renderModule(files) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT BY HAND.',
    '//',
    '// Produced by packages/link-watchdog/tools/embed-source.mjs from the real',
    '// package source. Regenerate after changing the package:',
    '//',
    '//   node packages/link-watchdog/tools/embed-source.mjs',
    '//',
    '// This is the payload for the Broken Link & Uptime Watchdog product: the',
    '// complete, runnable source the buyer receives at checkout. It is embedded',
    '// rather than read from disk so fulfilment cannot fail on a missing file.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const LINK_WATCHDOG_SOURCE: SourceFile[] = [',
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
