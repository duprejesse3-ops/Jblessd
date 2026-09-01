// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcg-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcg-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcg-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('add-connector').addEventListener('click', async () => {
  const name = document.getElementById('c-name').value.trim()
  const baseUrl = document.getElementById('c-url').value.trim()
  const tokenVal = document.getElementById('c-token').value.trim()
  const data = await api('/api/connectors', { method: 'POST', body: JSON.stringify({ name, baseUrl, token: tokenVal }) })
  if (!data.error) {
    document.getElementById('c-name').value = ''
    document.getElementById('c-url').value = ''
    document.getElementById('c-token').value = ''
  }
  await refreshStatus()
})

function badgeFor(result) {
  if (!result.reachable) return '<span class="badge offline">offline</span>'
  if (result.safeMode === 'read-only') return '<span class="badge ro">read-only</span>'
  if (result.safeMode === 'read-write') return '<span class="badge rw">read/write</span>'
  return '<span class="badge na">no safe mode</span>'
}

async function refreshStatus() {
  const { results } = await api('/api/status')
  const el = document.getElementById('connectors')
  el.innerHTML = results.length
    ? results.map((r) => `
      <div class="connector">
        <strong>${r.name}</strong> ${badgeFor(r)}
        <div class="meta">${r.reachable ? `${r.recentEntryCount} recent events` : 'unreachable'}</div>
        <button class="ghost" data-remove="${r.id}">Remove</button>
      </div>
    `).join('')
    : '<p class="sub">No connectors registered yet.</p>'
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/connectors/${btn.dataset.remove}`, { method: 'DELETE' })
      await refreshStatus()
    })
  })
}
document.getElementById('refresh-status').addEventListener('click', refreshStatus)

document.getElementById('kill-switch').addEventListener('click', async () => {
  if (!confirm('Switch every registered connector to read-only?')) return
  const { results } = await api('/api/kill-switch', { method: 'POST' })
  const el = document.getElementById('kill-result')
  el.innerHTML = results.map((r) => `<div class="log-entry">${r.ok ? '✓' : '✗'} ${r.name}: ${r.message}</div>`).join('')
  await refreshStatus()
  await refreshLog()
})

document.getElementById('clear-log').addEventListener('click', async () => {
  await api('/api/log/clear', { method: 'POST' })
  await refreshLog()
})
async function refreshLog() {
  const { entries } = await api('/api/log?limit=50')
  const el = document.getElementById('log')
  el.innerHTML = entries.length
    ? entries.map((e) => `<div class="log-entry"><span class="tag">${e.kind} · ${e.at}</span><br/>${e.summary}</div>`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshStatus()
  await refreshLog()
  setInterval(() => { refreshStatus(); refreshLog() }, 8000)
}

if (token) init()
