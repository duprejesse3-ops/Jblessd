#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// What .github-workflow-template/release-notes-bot.yml runs when a release is
// published. Writes the customer-facing entry into CHANGELOG.md (the
// workflow commits it), posts the internal summary to Slack, and prints the
// customer changelog to stdout so the workflow can also attach it to the
// GitHub Release body via `gh release edit`.
//
// Usage inside the workflow (see the template for the full step):
//   node bin/release-notes.mjs <previous-tag> <current-tag>
//
// previous-tag can be empty ('') for a first release — nothing to compare
// against, so it produces a placeholder entry rather than failing.

import { mergedSince } from '../lib/github.mjs'
import { draftReleaseNotes } from '../lib/release-notes.mjs'
import { prependChangelog } from '../lib/changelog.mjs'
import { postToSlack } from '../lib/slack.mjs'

async function main() {
  const [, , previousTag, currentTag] = process.argv
  if (!currentTag) {
    console.error('Usage: release-notes.mjs <previous-tag-or-empty> <current-tag>')
    process.exitCode = 1
    return
  }

  console.error(`Finding PRs merged between ${previousTag || '(start)'} and ${currentTag}...`)
  const prs = await mergedSince(previousTag, currentTag)
  console.error(`Found ${prs.length} merged PR(s). Drafting release notes...`)

  const notes = await draftReleaseNotes(currentTag, prs)

  const changelogPath = process.env.CHANGELOG_PATH || 'CHANGELOG.md'
  prependChangelog(changelogPath, notes.customerChangelog)
  console.error(`Updated ${changelogPath}`)

  // Printed for the workflow to capture and attach to the GitHub Release.
  console.log(notes.customerChangelog)

  const posted = await postToSlack(notes, process.env.SLACK_WEBHOOK_URL)
  console.error(posted ? 'Posted internal summary to Slack.' : 'Slack not configured or post failed.')
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exitCode = 1
})
