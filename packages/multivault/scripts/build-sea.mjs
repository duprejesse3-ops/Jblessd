#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Builds a standalone, double-clickable executable using Node's own built-in
// Single Executable Application (SEA) support — no third-party binary
// download, no cross-compilation. This is deliberately NOT a cross-platform
// build: SEA works by injecting a JS blob into a COPY of the Node binary
// that's already on the machine running this script, so it produces a
// binary for whatever OS/architecture you run it on.
//
// To get all of Windows, macOS, and Linux binaries, run this once on each:
//   - On Windows:      node scripts/build-sea.mjs   -> dist/vault-win-x64.exe
//   - On a Mac:        node scripts/build-sea.mjs   -> dist/vault-macos-<arch>
//   - On Linux:        node scripts/build-sea.mjs   -> dist/vault-linux-x64
//
// Requires Node 20+ and normal internet access (esbuild/postject need to
// install from npm the first time). Verified working end-to-end on Linux —
// see README's "Standalone binaries" section for the unsigned-binary
// warnings you'll want to know about before shipping these to buyers.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform, arch } from 'node:process'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'dist')
const TMP = join(ROOT, 'dist-tmp')

const PLATFORM_NAMES = { win32: 'win', darwin: 'macos', linux: 'linux' }
const outName = `vault-${PLATFORM_NAMES[platform] ?? platform}-${arch}${platform === 'win32' ? '.exe' : ''}`

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT })
}

mkdirSync(DIST, { recursive: true })
mkdirSync(TMP, { recursive: true })

console.log('1/4 Bundling ESM source into a single CommonJS file (esbuild)...')
run('npx', [
  'esbuild',
  join(ROOT, 'bin/vault.mjs'),
  '--bundle',
  '--platform=node',
  '--format=cjs',
  `--outfile=${join(TMP, 'vault-bundle.cjs')}`,
  '--external:node:*',
])

console.log('2/4 Generating the SEA preparation blob...')
const seaConfigPath = join(TMP, 'sea-config.json')
run('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(seaConfigPath)}, JSON.stringify({ main: ${JSON.stringify(join(TMP, 'vault-bundle.cjs'))}, output: ${JSON.stringify(join(TMP, 'sea-prep.blob'))}, disableExperimentalSEAWarning: true }))`])
run('node', ['--experimental-sea-config', seaConfigPath])

console.log('3/4 Copying the local Node binary as the base...')
const outPath = join(DIST, outName)
copyFileSync(process.execPath, outPath)
if (platform !== 'win32') chmodSync(outPath, 0o755)

console.log('4/4 Injecting the blob (postject)...')
const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
const postjectArgs = [outPath, 'NODE_SEA_BLOB', join(TMP, 'sea-prep.blob'), '--sentinel-fuse', sentinel]
if (platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA')
run('npx', ['postject', ...postjectArgs])

console.log(`\nDone: ${outPath}`)
if (platform === 'darwin') {
  console.log('macOS note: this binary is not notarized/signed. Buyers will need to')
  console.log('right-click -> Open the first time, or run: xattr -d com.apple.quarantine <path>')
} else if (platform === 'win32') {
  console.log('Windows note: this binary is not code-signed. SmartScreen will warn on first run.')
}
