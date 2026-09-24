// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcs-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcs-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcs-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-connect').addEventListener('click', async () => {
  const shopDomain = document.getElementById('shop-domain').value.trim()
  const accessToken = document.getElementById('access-token').value.trim()
  const webhookSecret = document.getElementById('webhook-secret').value.trim()
  await api('/api/config', { method: 'POST', body: JSON.stringify({ shopDomain, accessToken, webhookSecret }) })
  document.getElementById('access-token').value = ''
  document.getElementById('webhook-secret').value = ''
  await refreshConfig()
})

document.getElementById('save-safe').addEventListener('click', async () => {
  const safeMode = document.getElementById('safe-mode').value
  const lowStockThreshold = Number(document.getElementById('low-stock').value)
  await api('/api/config', { method: 'POST', body: JSON.stringify({ safeMode, lowStockThreshold }) })
  await refreshConfig()
})

document.getElementById('sync-products').addEventListener('click', async () => {
  const el = document.getElementById('sync-result')
  el.textContent = 'Fetching products…'
  const data = await api('/api/products')
  el.textContent = data.error ? `Error: ${data.error}` : `Fetched ${data.products.length} products.`
  await refreshLog()
})
document.getElementById('sync-orders').addEventListener('click', async () => {
  const el = document.getElementById('sync-result')
  el.textContent = 'Fetching orders…'
  const data = await api('/api/orders')
  el.textContent = data.error ? `Error: ${data.error}` : `Fetched ${data.orders.length} orders.`
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
    ? entries.map((e) => `<div class="log-entry ${e.kind === 'error' ? 'error' : ''}"><span class="tag">${e.kind} · ${e.at}</span><br/>${e.summary}</div>`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function refreshConfig() {
  const config = await api('/api/config')
  document.getElementById('shop-domain').value = config.shopDomain || ''
  document.getElementById('webhook-url').value = `${location.origin}/webhook`
  document.getElementById('safe-mode').value = config.safeMode
  document.getElementById('low-stock').value = config.lowStockThreshold || 10
  const badge = document.getElementById('safe-badge')
  badge.textContent = config.safeMode
  badge.className = `safe-badge ${config.safeMode === 'read-write' ? 'rw' : 'ro'}`
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
  await refreshLog()
  setInterval(refreshLog, 5000)
}

if (token) init()
