// Regenerates netlify/lib/multiconnect-webhook-bridge-source.mts from the real
// package source.
//
// Run this after changing anything in the package:
//
//   node packages/multiconnect-webhook-bridge/tools/embed-source.mjs
//
// Same rationale as packages/site-audit-agent/tools/embed-source.mjs: the
// storefront delivers digital goods as a single Markdown document (see
// netlify/lib/deliverables.mts), and a Netlify Function cannot reliably read
// arbitrary repo paths at runtime unless they are bundled. Embedding makes
// delivery deterministic — whatever is in the module is what the buyer
// receives, with no filesystem, no network, and no failure mode at purchase
// time.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'multiconnect-webhook-bridge-source.mts')

// Everything a buyer needs, in the order it should appear in the document.
// `tools/` is excluded: it is the seller's build step, not part of the product.
const INCLUDE_DIRS = ['lib', 'bin', 'adapters', 'test']
const INCLUDE_FILES = ['README.md', 'LICENSE.md', 'package.json', 'install.sh', 'install.ps1']

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
    '// Produced by packages/multiconnect-webhook-bridge/tools/embed-source.mjs from',
    '// the real package source. Regenerate after changing the package:',
    '//',
    '//   node packages/multiconnect-webhook-bridge/tools/embed-source.mjs',
    '//',
    '// This is the payload for the MultiConnect: Zapier/Webhook Bridge product',
    '// (SKU AI-CN-001): the complete, runnable source the buyer receives at',
    '// checkout. It is embedded rather than read from disk so fulfilment cannot',
    '// fail on a missing file.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const MULTICONNECT_WEBHOOK_BRIDGE_SOURCE: SourceFile[] = [',
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
