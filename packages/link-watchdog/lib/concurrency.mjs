// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A tiny concurrency pool. This engine's whole job is "make a lot of HTTP
// requests to someone's own site" — with no limit that is a self-inflicted
// denial-of-service. This keeps at most `limit` requests in flight at once
// and preserves the input order in the output array, without a queue
// library or any dependency.

/**
 * Runs `worker` over `items` with at most `limit` calls in flight at once.
 * Results are returned in the same order as `items`, regardless of which
 * one finishes first.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit  concurrent workers (clamped to at least 1, and to
 *   items.length so an empty/short list never starts an idle worker)
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  if (items.length === 0) return results

  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  let cursor = 0

  async function run() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workers }, run))
  return results
}
