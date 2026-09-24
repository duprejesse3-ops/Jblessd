// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Local storage for the refresh token and Drive scope config, so scheduled
// runs (cron/launchd/Task Scheduler) don't need a human present to
// re-authorize each time.
//
// Stored as plain JSON, not encrypted — the same trade this whole product
// line makes elsewhere (see MultiVault's vault.meta.json): encrypting it
// would mean a human has to type a passphrase before every unattended
// scheduled run, which defeats the point of "unattended." Instead: the file
// is written with 0600 permissions (owner read/write only) on Unix-like
// systems, and — like every other "this file is sensitive, protect the
// folder it's in" note in this product line — that's the honest mitigation,
// not encryption theater. Windows doesn't have a direct equivalent to Unix
// file-mode bits; NTFS permissions are the real control there, inherited
// from the folder — keep the config folder itself access-controlled.
//
// The refresh token is a real bearer credential: anyone who reads this file
// gets read-only access to the Drive account it was issued for, until it's
// revoked at https://myaccount.google.com/permissions.

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import process from 'node:process'

export function defaultConfigPath() {
  return join(homedir(), '.multivault-docs-bridge', 'config.json')
}

export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    throw new Error(`Config file at ${configPath} exists but is not valid JSON. Delete it and run "docs-bridge auth" again.`)
  }
}

export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  if (process.platform !== 'win32') {
    try {
      chmodSync(configPath, 0o600)
    } catch {
      // Best-effort — a filesystem that doesn't support Unix permission bits
      // (some network mounts) shouldn't fail the whole save.
    }
  }
}
