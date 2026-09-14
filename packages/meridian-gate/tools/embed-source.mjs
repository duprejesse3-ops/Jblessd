// Regenerates netlify/lib/meridian-gate-source.mts from the real package source.
//
// Run this after changing anything in the package:
//
//   node packages/meridian-gate/tools/embed-source.mjs
//
// Same reasoning as every other source product's embed script: the
// storefront delivers digital goods as a single document assembled at
// checkout, so a source-code product's payload has to be the actual files,
// embedded rather than read from disk at request time — deterministic
// delivery, no filesystem, no network, no failure mode at purchase.
//
// `npm test` in the package asserts the generated module is in sync with
// the source, so a stale embed fails the suite rather than silently
// shipping an old version to a paying customer.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'meridian-gate-source.mts')

// Everything a buyer needs, in the order it should appear in the document.
// `tools/` is excluded: it is the seller's build step, not part of the product.
const INCLUDE_DIRS = ['lib', 'bin', 'adapters', 'test']
const INCLUDE_FILES = ['README.md', 'LICENSE.md', 'package.json', 'install.sh']

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
    // Always emit POSIX separators so the generated module is identical on any OS.
    const rel = relative(PACKAGE_DIR, path).split(sep).join('/')
    files.push({ path: rel, contents: readFileSync(path, 'utf8') })
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
    '// Produced by packages/meridian-gate/tools/embed-source.mjs from the real',
    '// package source. Regenerate after changing the package:',
    '//',
    '//   node packages/meridian-gate/tools/embed-source.mjs',
    '//',
    '// This is the payload for the Meridian Gate product (SKU AI-HOST-002): the',
    '// complete, runnable source the buyer receives at checkout. It is embedded',
    '// rather than read from disk so fulfilment cannot fail on a missing file.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const MERIDIAN_GATE_SOURCE: SourceFile[] = [',
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

// Only write when run directly, so the test suite can import collect/renderModule
// to verify the checked-in module matches without rewriting it.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const files = collect()
  const module = renderModule(files)
  writeFileSync(OUTPUT, module)
  const bytes = files.reduce((sum, f) => sum + f.contents.length, 0)
  process.stdout.write(`Wrote ${relative(REPO_ROOT, OUTPUT)} — ${files.length} files, ${bytes} bytes of source\n`)
}
