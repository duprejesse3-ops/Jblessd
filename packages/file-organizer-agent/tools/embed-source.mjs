// Regenerates netlify/lib/file-organizer-source.mts from the real package
// source.
//
// Run this after changing anything in the package:
//
//   node packages/file-organizer-agent/tools/embed-source.mjs
//
// Why embed at all: the storefront delivers digital goods as a single Markdown
// document (see netlify/lib/deliverables.mts). For a source-code product that
// document has to contain the actual files, and a Netlify Function cannot
// reliably read arbitrary repo paths at runtime unless they are bundled. Turning
// the package into a plain TypeScript module of string constants makes delivery
// deterministic: whatever is in the module is what the buyer receives, with no
// filesystem, no network, and no failure mode at purchase time.
//
// The duplication this creates is real, so `npm test` in the package should
// assert the generated module is in sync with the source — see
// site-audit-agent's test suite for the pattern to add here. A stale embed
// fails the suite rather than silently shipping an old version to a paying
// customer.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'file-organizer-source.mts')

// Everything a buyer needs, in the order it should appear in the document.
// `tools/` is excluded: it is the seller's build step, not part of the product.
const INCLUDE_DIRS = ['lib', 'bin', 'adapters', 'test']
const INCLUDE_FILES = ['README.md', 'LICENSE.md', 'package.json']

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
    '// Produced by packages/file-organizer-agent/tools/embed-source.mjs from the',
    '// real package source. Regenerate after changing the package:',
    '//',
    '//   node packages/file-organizer-agent/tools/embed-source.mjs',
    '//',
    '// This is the payload for the File Organizer Agent product: the complete,',
    '// runnable source the buyer receives at checkout. It is embedded rather',
    '// than read from disk so fulfilment cannot fail on a missing file.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const FILE_ORGANIZER_SOURCE: SourceFile[] = [',
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

// Only write when run directly, so a future test suite can import
// collect/renderModule to verify the checked-in module matches without
// rewriting it — same pattern as site-audit-agent's embed-source.mjs.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const files = collect()
  const module = renderModule(files)
  writeFileSync(OUTPUT, module)
  const bytes = files.reduce((sum, f) => sum + f.contents.length, 0)
  process.stdout.write(`Wrote ${relative(REPO_ROOT, OUTPUT)} — ${files.length} files, ${bytes} bytes of source\n`)
}
