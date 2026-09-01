// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcw-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcw-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcw-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

async function runVerify() {
  const result = await api('/api/verify')
  const el = document.getElementById('verify-status')
  if (result.valid) {
    el.innerHTML = `<div class="verify-status ok">✓ Chain intact — ${result.totalEntries} entries, all verified.</div>`
  } else {
    el.innerHTML = `<div class="verify-status broken">✗ Chain broken at entry ${result.brokenAtSeq}.<br/>${result.reason}</div>`
  }
}
document.getElementById('run-verify').addEventListener('click', runVerify)

async function refreshEntries() {
  const { entries } = await api('/api/entries?limit=50')
  const el = document.getElementById('entries')
  el.innerHTML = entries.length
    ? entries.map((e) => `
      <div class="entry">
        <span class="tag">#${e.seq} · ${e.source} · ${e.at}</span><br/>
        <strong>${e.action}</strong>${e.detail ? ' — ' + e.detail : ''}<br/>
        <span class="hash">hash: ${e.hash}</span>
      </div>
    `).join('')
    : '<p class="sub">No events yet.</p>'
}
document.getElementById('refresh').addEventListener('click', refreshEntries)

async function init() {
  gate.hidden = true
  app.hidden = false
  const config = await api('/api/config')
  document.getElementById('ingest-url').value = `${location.origin}/api/events`
  document.getElementById('ingest-token').value = config.ingestToken
  await runVerify()
  await refreshEntries()
}

if (token) init()
