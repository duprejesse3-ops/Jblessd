#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point: reads config.json, checks each SKU's live Shopify stock,
// groups anything at/below threshold by supplier, and sends one PO email
// (with a CSV attached) per supplier that needs one. Safe to run as often
// as you like — a SKU that isn't low doesn't get touched, and there's no
// state to corrupt between runs (see README for why duplicate POs across
// runs are a non-issue in practice, and how to avoid them if it matters to you).

import { loadConfig } from '../lib/config.mjs'
import { getAvailableBySku } from '../lib/shopify-client.mjs'
import { groupReorderBySupplier } from '../lib/threshold.mjs'
import { buildPoCsv, buildPoEmailBody, generatePoNumber } from '../lib/po-builder.mjs'
import { sendPoEmail } from '../lib/mailer.mjs'
import { postSummary } from '../lib/slack.mjs'

async function main() {
  const configPath = process.env.PO_CONFIG_PATH ?? new URL('../config.json', import.meta.url).pathname
  const config = loadConfig(configPath)

  const available = await getAvailableBySku(config.map((c) => c.sku))
  const withStock = config.map((c) => ({ ...c, available: available.get(c.sku) ?? 0 }))

  const bySupplier = groupReorderBySupplier(withStock)
  const results = []
  let n = 0

  for (const [, group] of bySupplier) {
    n += 1
    const poNumber = generatePoNumber(n)
    const csv = buildPoCsv(poNumber, group.items)
    const body = buildPoEmailBody(poNumber, group.supplierName, group.items, process.env.STORE_NAME)

    const sent = await sendPoEmail({
      to: group.supplierEmail,
      subject: `Purchase order ${poNumber}${process.env.STORE_NAME ? ` — ${process.env.STORE_NAME}` : ''}`,
      text: body,
      fromName: process.env.STORE_NAME,
      attachment: { filename: `${poNumber}.csv`, content: csv },
    })

    console.log(`${sent ? 'Sent' : 'Built (not sent)'} ${poNumber} to ${group.supplierName} — ${group.items.length} item(s)`)
    results.push({ poNumber, supplierName: group.supplierName, itemCount: group.items.length, sent })
  }

  if (results.length === 0) {
    console.log('Nothing at or below its reorder threshold. No POs needed.')
  }

  await postSummary(results, process.env.SLACK_WEBHOOK_URL)
}

main().catch((err) => {
  console.error(`supplier-po-sync failed: ${err.message}`)
  process.exitCode = 1
})
