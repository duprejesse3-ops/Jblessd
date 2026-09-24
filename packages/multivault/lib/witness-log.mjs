// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional, best-effort integration with MultiWitness (sold separately) —
// its tamper-evident, hash-chained local log. If MULTIWITNESS_INGEST_TOKEN
// is set, every context-serving event is logged there: what was served and
// when, NEVER the actual file/calendar content. This is what makes "provably
// logged" a real claim rather than a slogan — the log is independently
// verifiable offline (see MultiWitness's own `witness verify`), and its
// hash chain means a served-context event can't be quietly edited or
// deleted after the fact without breaking the chain.
//
// Entirely optional: MultiVault works exactly the same with or without
// MultiWitness installed. A missing token, an unreachable server, or a
// slow response all fail silently here — logging what the AI saw must
// never be able to block or break serving it that context in the first
// place.

const LOG_TIMEOUT_MS = 800 // local loopback call — generous but bounded so a stalled MultiWitness never noticeably delays a context response

/**
 * Best-effort: log a context-serving event to MultiWitness, if configured.
 * Never throws — a logging failure must never prevent context from being
 * served. Returns true if the event was actually logged, false otherwise
 * (not configured, MultiWitness unreachable, etc.) — callers that want to
 * report logging status (e.g. an MCP tool's response) can use this, but
 * nothing should ever branch on it to decide whether to proceed.
 */
export async function logContextServed(detail) {
  const token = process.env.MULTIWITNESS_INGEST_TOKEN
  if (!token) return false
  const url = process.env.MULTIWITNESS_URL || 'http://localhost:8429'

  try {
    const res = await fetch(`${url}/api/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'multivault', action: 'context.served', detail }),
      signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    // MultiWitness not running, wrong port, network hiccup — all the same
    // outcome here: proceed without logging. See module comment.
    return false
  }
}

/** Whether MultiWitness logging is configured at all (for status/UX only). */
export function witnessConfigured() {
  return Boolean(process.env.MULTIWITNESS_INGEST_TOKEN)
}
