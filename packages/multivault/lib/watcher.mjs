// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional background watcher: keeps the index updated reactively via
// fs.watch instead of relying solely on the on-query incremental scan (see
// ensureIndex in lib/vault.mjs). Both approaches are correct — the on-query
// path already handles "index might be stale" on every call — this exists
// purely as a latency optimization for very large trees, where even a
// stat()-only walk of thousands of files on every single query adds
// noticeable delay. Run `vault watch` once and queries stay fast because
// the index is already current by the time they arrive.
//
// Node's fs.watch recursive option is NOT cross-platform: it works natively
// on macOS and Windows, but on Linux it throws (inotify has no native
// recursive-watch primitive). This module handles that honestly rather than
// silently under-watching on Linux: it watches every subdirectory
// individually there, discovered via the same walkFiles() used elsewhere,
// and re-scans for newly-created subdirectories periodically (60s) since a
// brand-new directory has no watch on it yet until the next such pass.
//
// Debounced: filesystem events tend to arrive in bursts (an editor's
// save-as-temp-then-rename pattern can fire several events for one logical
// save) — changes are batched for DEBOUNCE_MS before a single incremental
// update runs, rather than re-indexing on every individual event.

import { watch } from 'node:fs'
import { platform } from 'node:process'
import { walkFiles } from './scan.mjs'
import { loadIndex, buildIndex, updateIndex, saveIndex } from './indexer.mjs'

const DEBOUNCE_MS = 800
const LINUX_RESCAN_INTERVAL_MS = 60_000

/**
 * Start watching `folder` and keep the index at `dest` continuously
 * updated. Returns a controller with stop() to tear everything down —
 * used by tests, and by `vault watch` to handle Ctrl+C cleanly.
 */
export function startWatcher(dest, folder, opts = {}) {
  let index = loadIndex(dest)
  if (!index || index.folder !== folder) index = buildIndex(folder, opts)
  saveIndex(dest, index)

  let debounceTimer = null
  let stopped = false
  const onEvent = opts.onUpdate ?? (() => {})

  function scheduleUpdate() {
    if (stopped) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (stopped) return
      const result = updateIndex(index, folder, opts)
      index = result.index
      saveIndex(dest, index)
      if (result.added || result.updated || result.removed) onEvent(result)
    }, DEBOUNCE_MS)
  }

  const watchers = []

  if (platform !== 'linux') {
    // macOS/Windows: fs.watch's recursive option is a real, single OS-level
    // watch covering the whole subtree.
    try {
      watchers.push(watch(folder, { recursive: true }, scheduleUpdate))
    } catch {
      // Fall through to the manual per-directory approach below if the
      // platform claims recursive support but it fails in practice.
    }
  }

  let rescanTimer = null
  if (platform === 'linux' || watchers.length === 0) {
    const watchedDirs = new Set()
    function watchAllDirs() {
      if (stopped) return
      const dirs = new Set([folder, ...walkFiles(folder, opts).map((f) => f.fullPath.slice(0, f.fullPath.length - f.name.length - 1))])
      for (const dir of dirs) {
        if (watchedDirs.has(dir)) continue
        try {
          watchers.push(watch(dir, scheduleUpdate))
          watchedDirs.add(dir)
        } catch {
          // Directory vanished between the walk and the watch call, or a
          // permissions issue — skip it rather than fail the whole watcher.
        }
      }
    }
    watchAllDirs()
    rescanTimer = setInterval(watchAllDirs, LINUX_RESCAN_INTERVAL_MS)
  }

  return {
    stop() {
      stopped = true
      clearTimeout(debounceTimer)
      if (rescanTimer) clearInterval(rescanTimer)
      for (const w of watchers) w.close()
    },
    getIndex() {
      return index
    },
  }
}
