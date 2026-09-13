#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// What .github-workflow-template/code-review-digest.yml actually runs. Reads
// SLACK_WEBHOOK_URL and ANTHROPIC_API_KEY from the environment (set as repo
// secrets in the workflow), GITHUB_TOKEN and GITHUB_REPOSITORY are already
// present inside Actions.
//
// Also runnable by hand outside Actions, against any repo, for testing:
//   GITHUB_TOKEN=ghp_... GITHUB_REPOSITORY=you/repo node bin/digest.mjs

import { listOpenPRs } from '../lib/github.mjs'
import { draftDigest } from '../lib/digest.mjs'
import { postToSlack } from '../lib/slack.mjs'

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    if (a === '--version') args.version = true
    if (a === '--json') args.json = true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.version) {
    console.log('code-review-digest 1.0.0')
    return
  }

  console.error('Fetching open pull requests...')
  const prs = await listOpenPRs()
  console.error(`Found ${prs.length} open PR(s). Drafting digest...`)
  const digest = await draftDigest(prs)

  if (args.json) {
    console.log(JSON.stringify(digest, null, 2))
  } else {
    console.log(`\n${digest.headline}\n`)
    if (digest.needsAttention?.length) {
      console.log('Needs attention:')
      for (const pr of digest.needsAttention) console.log(`  #${pr.number} ${pr.title} (${pr.author}) — ${pr.reason}`)
    }
    if (digest.fine?.length) {
      console.log('\nFine to leave:')
      for (const pr of digest.fine) console.log(`  #${pr.number} ${pr.title}`)
    }
  }

  const posted = await postToSlack(digest, process.env.SLACK_WEBHOOK_URL)
  console.error(posted ? '\nPosted to Slack.' : '\nSlack not configured or post failed — see warning above.')
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exitCode = 1
})
