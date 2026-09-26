#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point: reads a CSV of leads (a "domain" or "url" column, plus
// whatever other columns your export already has), fetches each company's
// real homepage, hands the extracted text to Claude for a four-field
// enrichment, and writes an enriched CSV alongside the original columns.
// Already-enriched domains are skipped on a re-run via cache.json, so
// growing your lead list over time never re-spends API calls on ones
// you've already researched.

import { parseCsv, toCsv } from '../lib/csv.mjs'
import { fetchSiteText } from '../lib/site-fetch.mjs'
import { buildEnrichmentPrompt, parseEnrichmentResponse } from '../lib/enrichment.mjs'
import { callClaude } from '../lib/claude-client.mjs'
import { loadCache, saveCache, hasCached, recordCache } from '../lib/cache.mjs'
import { readFileSync, writeFileSync } from 'node:fs'

function domainOf(row) {
  return row.domain || row.url || row.website || row.company_url || ''
}

async function main() {
  const inputPath = process.env.RESEARCH_INPUT_CSV ?? new URL('../leads.csv', import.meta.url).pathname
  const outputPath = process.env.RESEARCH_OUTPUT_CSV ?? new URL('../enriched-leads.csv', import.meta.url).pathname
  const cachePath = process.env.RESEARCH_CACHE_PATH ?? new URL('../cache.json', import.meta.url).pathname

  const rows = parseCsv(readFileSync(inputPath, 'utf8'))
  if (rows.length === 0) {
    console.log(`No leads found in ${inputPath}.`)
    return
  }

  let cache = loadCache(cachePath)
  const enriched = []
  let researched = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const domain = domainOf(row).trim()
    if (!domain) {
      console.warn('Skipping a row with no domain/url/website column populated.')
      enriched.push(row)
      continue
    }

    if (hasCached(cache, domain)) {
      enriched.push({ ...row, ...cache[domain] })
      skipped++
      continue
    }

    try {
      const site = await fetchSiteText(domain)
      const prompt = buildEnrichmentPrompt(site)
      const reply = await callClaude(prompt)
      const fields = parseEnrichmentResponse(reply)
      cache = recordCache(cache, domain, fields)
      enriched.push({ ...row, ...fields })
      researched++
      console.log(`Researched ${domain}`)
    } catch (err) {
      console.error(`Failed to research ${domain}: ${err.message}`)
      enriched.push({ ...row, industry: '', sizeSignal: '', valueProp: '', contactPageGuess: '' })
      failed++
    }
  }

  saveCache(cachePath, cache)

  const columns = [...Object.keys(rows[0]), 'industry', 'sizeSignal', 'valueProp', 'contactPageGuess']
    .filter((col, i, all) => all.indexOf(col) === i)
  writeFileSync(outputPath, toCsv(enriched, columns))

  console.log(`\nDone. ${researched} researched, ${skipped} from cache, ${failed} failed. Wrote ${outputPath}.`)
}

main().catch((err) => {
  console.error(`lead-research-agent failed: ${err.message}`)
  process.exitCode = 1
})
