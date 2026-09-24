// Regenerates netlify/lib/fieldhand-source.mts from the real package source.
// Same pattern as the MultiWitness / MultiGuard embed scripts.
//
// Run this after changing anything in the package:
//
//   node packages/fieldhand/tools/embed-source.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..')
const OUTPUT = join(REPO_ROOT, 'netlify', 'lib', 'fieldhand-source.mts')

const INCLUDE_FILES = ['fieldhand.html', 'README.md']

function collect() {
  return INCLUDE_FILES.map((rel) => ({
    path: rel,
    contents: readFileSync(join(PACKAGE_DIR, rel), 'utf8'),
  }))
}

export function renderModule(files) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT BY HAND.',
    '//',
    '// Produced by packages/fieldhand/tools/embed-source.mjs from the real',
    '// package source. Regenerate after changing the package:',
    '//',
    '//   node packages/fieldhand/tools/embed-source.mjs',
    '//',
    '// This is the payload for the Fieldhand product (SKU AI-AG-118): the',
    '// complete file the buyer receives at checkout. It is embedded rather',
    '// than read from disk so fulfilment cannot fail on a missing file.',
    '//',
    '// contents fields are template literals (not JSON strings) so each file',
    '// keeps its natural line breaks here.',
    '',
    'export interface SourceFile {',
    '  path: string',
    '  contents: string',
    '}',
    '',
    'export const FIELDHAND_SOURCE: SourceFile[] = [',
  ]
  for (const file of files) {
    const escaped = file.contents.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    lines.push(`  { path: ${JSON.stringify(file.path)}, contents: \`${escaped}\` },`)
  }
  lines.push(']')
  lines.push('')
  return lines.join('\n')
}

const files = collect()
writeFileSync(OUTPUT, renderModule(files), 'utf8')
console.log(`Wrote ${OUTPUT} (${files.length} files, ${files.reduce((n, f) => n + f.contents.length, 0)} bytes)`)
