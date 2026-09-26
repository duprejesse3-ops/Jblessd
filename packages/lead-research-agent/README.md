# Lead Research & Enrichment Agent

Reads a CSV of company domains, fetches each company's real homepage,
extracts the readable text from it, and hands that to Claude for a
four-field enrichment: industry guess, any size signal it can find, a
one-sentence value prop, and a contact-page guess. Not a Make/Zapier
blueprint you assemble yourself — a working, multi-step agent that does
the fetch → extract → enrich → write loop on its own for every row in your
list.

## How this differs from a lookup *checklist*

A checklist tells a rep to go look up each company one by one. This agent
does the looking itself: it visits the real site, reads what's actually
there, and writes a structured guess back onto the row — across your whole
list, unattended. It also remembers which domains it has already
researched, so growing a lead list over time never re-spends an API call
on one it's already seen.

## What it does, precisely

1. Reads `leads.csv` — any CSV with a `domain`, `url`, or `website` column,
   plus whatever other columns your export already has (company name,
   contact name, source, anything).
2. For each row not already in `cache.json`, it fetches that company's real
   homepage with a plain HTTP GET (no headless browser — see the limits
   section below), strips it down to readable text, and sends that text to
   Claude with a fixed enrichment prompt.
3. Claude replies with four labeled lines — industry, size signal, value
   prop, contact page — which this agent parses back into columns. A field
   Claude can't determine comes back `unknown` and is stored as blank
   rather than a guess presented as fact.
4. Writes `enriched-leads.csv`: every original column, plus the four new
   enrichment columns, for every row.
5. Records what it found for that domain in `cache.json`, so re-running
   against a growing list only researches the new rows.

It does not scrape beyond the homepage, follow links, or use a headless
browser — a plain GET is what most marketing sites serve anyway, and
staying dependency-free is worth the (documented) limit that a JS-rendered
single-page app will come back thin. If a fetch or the Claude call fails
for a specific domain, that row is written with blank enrichment columns
and the run continues — one bad domain never stops the batch.

## Install (10 minutes)

1. Copy `bin/`, `lib/`, and `leads.example.csv` into your repo — anywhere,
   e.g. `tools/lead-research-agent/`.
2. Copy `leads.example.csv` to `leads.csv` in that same folder and replace
   it with your real list (keep a `domain`, `url`, or `website` column).
3. Copy `.github-workflow-template/lead-research.yml` to
   `.github/workflows/lead-research.yml` (this exact path — GitHub only
   runs workflows from there).
4. If you put `bin/`/`lib/` somewhere other than `tools/lead-research-agent/`,
   edit the `working-directory:` lines in the workflow to match.
5. Add the repo secret (**Settings → Secrets and variables → Actions**):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com/settings/keys
6. Commit and push. Trigger it once immediately from the **Actions** tab
   (`workflow_dispatch`) to check it actually works, and download the
   `enriched-leads` artifact it uploads.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in ANTHROPIC_API_KEY
cp leads.example.csv leads.csv   # or your own real list
node bin/research.mjs
```

```sh
npm test
```
Runs without any real API key, network call, or live site fetch — checks
CSV parsing/round-tripping, HTML-to-text stripping, prompt construction,
labeled-response parsing (including the "unknown" → blank behavior), and
the enrichment cache, not a live Claude call or a real site fetch.

## On cache.json

This product tracks, per domain, the last enrichment it found — that's the
entire job of `cache.json`, and it's the only state this product keeps.
It's a plain JSON file, not a database, so you can read it, edit it, or
delete a domain's entry by hand to force it to be re-researched on the
next run. If `cache.json` goes missing entirely, the next run treats every
domain as never having been researched.

## Limits, honestly

- No headless browser: a JS-rendered single-page app's homepage may return
  little to no readable text. The enrichment for that row will lean more
  heavily on the page `<title>` and whatever server-rendered text exists.
- One page per domain: it does not crawl an About or Team page on its own,
  even though the "contact page" field is a guess at one existing. Feed it
  a more specific URL in the `domain`/`url` column if you already know the
  right page.
- The four fields are Claude's best reading of homepage text, not verified
  facts — treat "size signal" and "industry" as a starting point for a
  rep to confirm, not a database lookup.

## License

See `LICENSE.md`. One-time purchase, for your own use — run it against
unlimited domains and lead lists, not for resale as a standalone product.
