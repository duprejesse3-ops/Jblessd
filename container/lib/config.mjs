// A deliberately small TOML reader for netlify.toml.
//
// The container needs the redirects, the header rules, the publish directory
// and the edge-function declarations. Copying them into a second file would
// mean every future netlify.toml edit silently fails to reach the container, so
// this parses the real file instead and there is exactly one source of truth.
//
// This handles the subset netlify.toml actually uses — tables, array-of-tables,
// nested [headers.values], strings, integers, booleans and string arrays
// (inline or multi-line) — and nothing more. It is not a general TOML parser
// and does not try to be; anything outside that subset is ignored rather than
// guessed at.

import { readFileSync } from 'node:fs'

/** Strips a trailing comment, respecting quoted strings that may contain '#'. */
function stripComment(line) {
  let quote = null
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '#') {
      return line.slice(0, i)
    }
  }
  return line
}

function parseScalar(raw) {
  const text = raw.trim()
  if (!text) return ''
  if (text.startsWith('"')) return JSON.parse(text)
  if (text.startsWith("'")) return text.slice(1, -1)
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^-?\d+$/.test(text)) return Number(text)
  return text
}

/** Splits an inline array body on commas that are not inside a string. */
function parseArrayBody(body) {
  const items = []
  let current = ''
  let quote = null
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (quote) {
      current += ch
      if (ch === '\\') {
        current += body[i + 1] ?? ''
        i += 1
      } else if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (ch === ',') {
      if (current.trim()) items.push(parseScalar(current))
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) items.push(parseScalar(current))
  return items
}

export function parseToml(text) {
  const root = {}
  // The table the next key/value pair belongs to.
  let target = root
  // The most recent array-of-tables entry, so [headers.values] can attach to it.
  let lastArrayEntry = null

  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const line = stripComment(lines[i]).trim()
    if (!line) continue

    const arrayTable = line.match(/^\[\[([^\]]+)\]\]$/)
    if (arrayTable) {
      const name = arrayTable[1].trim()
      root[name] ??= []
      lastArrayEntry = {}
      root[name].push(lastArrayEntry)
      target = lastArrayEntry
      continue
    }

    const table = line.match(/^\[([^\]]+)\]$/)
    if (table) {
      const parts = table[1].trim().split('.')
      // A dotted name like [headers.values] nests inside the array-of-tables
      // entry that opened above it; a plain [build] is a root table.
      if (parts.length > 1 && lastArrayEntry) {
        let node = lastArrayEntry
        for (const part of parts.slice(1)) {
          node[part] ??= {}
          node = node[part]
        }
        target = node
      } else {
        root[parts[0]] ??= {}
        target = root[parts[0]]
        lastArrayEntry = null
      }
      continue
    }

    const pair = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/)
    if (!pair) continue
    const [, key, rawValue] = pair

    if (rawValue.startsWith('[') && !rawValue.includes(']')) {
      // Multi-line array: gather until the closing bracket.
      let body = rawValue.slice(1)
      while (i + 1 < lines.length) {
        i += 1
        const next = stripComment(lines[i])
        const end = next.indexOf(']')
        if (end !== -1) {
          body += next.slice(0, end)
          break
        }
        body += next
      }
      target[key] = parseArrayBody(body)
      continue
    }

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      target[key] = parseArrayBody(rawValue.slice(1, -1))
      continue
    }

    target[key] = parseScalar(rawValue)
  }

  return root
}

export function loadNetlifyConfig(path) {
  const parsed = parseToml(readFileSync(path, 'utf8'))
  return {
    publish: parsed.build?.publish || '.',
    functionsDir: parsed.build?.functions || 'netlify/functions',
    redirects: parsed.redirects || [],
    headers: parsed.headers || [],
    edgeFunctions: parsed.edge_functions || [],
  }
}
