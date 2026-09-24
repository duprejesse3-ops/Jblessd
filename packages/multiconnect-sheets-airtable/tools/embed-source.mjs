// Regenerates netlify/lib/multiconnect-sheets-airtable-source.mts from the
// real package source. Same pattern as the other MultiConnect embed scripts.
//
// Run this after changing anything in the package:
//
//   node packages/multiconnect-sheets-airtable/tools/embed-source.mjs

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'multiconnect-sheets-airtable-source.mts')

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
    const rel = relative(PACKAGE_DIR, path).split(sep).join('/')
    files.push({ path: rel, contents: readFileSync(path, 'utf8') })
  }
  return files
}

export function renderModule(files) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT BY HAND.',
    '//',
    '// Produced by packages/multiconnect-sheets-airtable/tools/embed-source.mjs',
    '// from the real package source. Regenerate after changing the package:',
    '//',
    '//   node packages/multiconnect-sheets-airtable/tools/embed-source.mjs',
    '//',
    '// This is the payload for the MultiConnect: Sheets/Airtable product (SKU',
    '// AI-CN-003): the complete, runnable source the buyer receives at',
    '// checkout. It is embedded rather than read from disk so fulfilment cannot',
    '// fail on a missing file.',
    '//',
    '// contents fields are template literals (not JSON strings) so each file',
    '// keeps its natural line breaks here.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const MULTICONNECT_SHEETS_AIRTABLE_SOURCE: SourceFile[] = [',
  ]

  for (const file of files) {
    const escaped = file.contents.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    lines.push('  {')
    lines.push(`    path: ${JSON.stringify(file.path)},`)
    lines.push('    contents: `' + escaped + '`,')
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
