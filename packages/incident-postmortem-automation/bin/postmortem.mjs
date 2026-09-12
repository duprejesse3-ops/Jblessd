#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Usage:
//   postmortem timeline.txt
//   postmortem timeline.txt --title "Checkout outage" --slack-webhook https://hooks.slack.com/...
//   cat timeline.txt | postmortem -
//
// Works with nothing but a text file and ANTHROPIC_API_KEY — the PagerDuty
// webhook (adapters/pagerduty-webhook.mjs) is for when you want this to run
// itself on every incident; this CLI is for running it on one incident right
// now, or for testing your setup before wiring the webhook at all.

import { readFileSync } from 'node:fs'
import { draftPostmortem } from '../lib/postmortem.mjs'
import { postToSlack } from '../lib/slack.mjs'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--title') args.title = argv[++i]
    else if (a === '--slack-webhook') args.slackWebhook = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--version') args.version = true
    else args._.push(a)
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.version) {
    console.log('incident-postmortem-automation 1.0.0')
    return
  }

  const source = args._[0]
  if (!source) {
    console.error('Usage: postmortem <timeline-file | -> [--title "..."] [--slack-webhook URL] [--json]')
    process.exitCode = 1
    return
  }

  const timelineText = source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8')

  console.error('Drafting postmortem...')
  const draft = await draftPostmortem(timelineText, { incidentTitle: args.title })

  if (args.json) {
    console.log(JSON.stringify(draft, null, 2))
  } else {
    console.log(`\n# ${draft.title}\n`)
    console.log(draft.summary + '\n')
    console.log('## Root cause\n' + draft.rootCause + '\n')
    console.log('## Timeline')
    for (const t of draft.timeline) console.log(`- ${t.time} — ${t.event}`)
    console.log('\n## Action items')
    for (const a of draft.actionItems) console.log(`- [ ] ${a.owner} — ${a.task}${a.dueBy ? ` (by ${a.dueBy})` : ''}`)
  }

  const webhook = args.slackWebhook ?? process.env.SLACK_WEBHOOK_URL
  if (webhook) {
    const posted = await postToSlack(draft, webhook)
    console.error(posted ? '\nPosted to Slack.' : '\nSlack post failed — see warning above.')
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exitCode = 1
})
