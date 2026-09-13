#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// What .github-workflow-template/architecture-diagram-sync.yml runs on every
// push to main. Prints whether the diagram actually changed, via exit code
// and a line on stdout — the workflow uses that to skip an empty commit.

import { scanRepo } from '../lib/scan.mjs'
import { draftDiagram } from '../lib/diagram.mjs'
import { writeDiagram } from '../lib/write.mjs'

async function main() {
  const root = process.env.REPO_ROOT || process.cwd()
  const outPath = process.env.DIAGRAM_PATH || 'docs/architecture.md'

  console.error(`Scanning ${root}...`)
  const scan = scanRepo(root)
  console.error(`Found ${scan.topLevelDirs.length} top-level dirs, ${scan.crossDirImports.length} cross-dir import edges.`)

  console.error('Drafting diagram...')
  const draft = await draftDiagram(scan)

  const changed = writeDiagram(outPath, draft)
  console.log(changed ? 'changed' : 'unchanged')
  console.error(changed ? `Wrote ${outPath}.` : `${outPath} already matches the current structure — nothing to commit.`)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exitCode = 1
})
