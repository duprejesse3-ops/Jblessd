// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Builds a factual summary of the repo's real structure: top-level
// directories, which of them import from which others (regex-based, not a
// full parser — deliberately, so this has zero dependencies and works on
// any JS/TS codebase without a build step), and which infra files actually
// exist. This is the input the diagram gets drawn from — nothing in the
// diagram step is allowed to invent a component that isn't in this scan.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vercel', '.netlify'])
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs'])
const IMPORT_RE = /(?:import[\s\S]*?from\s+|require\()\s*['"](\.[^'"]+)['"]/g

const INFRA_FILES = [
  'Dockerfile',
  'docker-compose.yml',
  'netlify.toml',
  'vercel.json',
  '.github/workflows',
  'terraform',
  'infra',
]

function walk(dir, root, out = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry) || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, root, out)
    else out.push(full)
  }
  return out
}

function topLevelDir(root, filePath) {
  const rel = relative(root, filePath)
  const first = rel.split('/')[0]
  return first || '.'
}

/**
 * @param {string} root   repo root to scan, defaults to cwd
 * @returns {{
 *   topLevelDirs: string[],
 *   fileCounts: Record<string, number>,
 *   crossDirImports: Array<{from:string, to:string, count:number}>,
 *   infra: string[],
 * }}
 */
export function scanRepo(root = process.cwd()) {
  const files = walk(root, root).filter((f) => CODE_EXT.has('.' + f.split('.').pop()))

  const fileCounts = {}
  const edgeCounts = new Map() // "from->to" -> count

  for (const file of files) {
    const dir = topLevelDir(root, file)
    fileCounts[dir] = (fileCounts[dir] ?? 0) + 1

    let contents
    try {
      contents = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    for (const match of contents.matchAll(IMPORT_RE)) {
      const resolved = join(dirname(file), match[1])
      const targetDir = topLevelDir(root, resolved)
      if (targetDir === dir) continue // same top-level dir, not a cross-boundary edge
      const key = `${dir}->${targetDir}`
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
    }
  }

  const crossDirImports = [...edgeCounts.entries()].map(([key, count]) => {
    const [from, to] = key.split('->')
    return { from, to, count }
  })

  const infra = INFRA_FILES.filter((f) => existsSync(join(root, f)))

  return {
    topLevelDirs: Object.keys(fileCounts).sort(),
    fileCounts,
    crossDirImports: crossDirImports.sort((a, b) => b.count - a.count),
    infra,
  }
}
