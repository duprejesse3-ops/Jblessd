// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Plain vanilla JS, no build step, no framework — this ships as source the
// buyer runs locally, so it stays dependency-free like the rest of the
// bridge. Talks only to same-origin /api/* routes.

let token = sessionStorage.getItem('mcb-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcb-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcb-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlock()
})

function mappingRow(rule, onRemove) {
  const row = document.createElement('div')
  row.className = 'row'
  row.innerHTML = `
    <input placeholder="source path (e.g. order.email)" value="${rule.sourcePath ?? ''}" data-field="sourcePath"/>
    <span class="tag">→</span>
    <input placeholder="target field (e.g. customer.email)" value="${rule.targetField ?? ''}" data-field="targetField"/>
    <button class="ghost" data-remove>×</button>
  `
  row.querySelector('[data-remove]').addEventListener('click', () => {
    row.remove()
    onRemove()
  })
  return row
}

function readRules(containerId) {
  const rows = document.querySelectorAll(`#${containerId} .row`)
  return Array.from(rows).map((row, i) => ({
    id: String(i),
    sourcePath: row.querySelector('[data-field="sourcePath"]').value.trim(),
    targetField: row.querySelector('[data-field="targetField"]').value.trim(),
  })).filter((r) => r.sourcePath && r.targetField)
}

function addMappingUI(containerId, rules) {
  const container = document.getElementById(containerId)
  container.innerHTML = ''
  for (const rule of rules) container.appendChild(mappingRow(rule, () => {}))
}

document.getElementById('add-outbound-rule').addEventListener('click', () => {
  document.getElementById('outbound-mapping').appendChild(mappingRow({}, () => {}))
})
document.getElementById('add-inbound-rule').addEventListener('click', () => {
  document.getElementById('inbound-mapping').appendChild(mappingRow({}, () => {}))
})

document.getElementById('save-outbound-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'outbound', rules: readRules('outbound-mapping') }) })
})
document.getElementById('save-inbound-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'inbound', rules: readRules('inbound-mapping') }) })
})

document.getElementById('save-connect').addEventListener('click', async () => {
  const outboundUrl = document.getElementById('outbound-url').value.trim() || null
  await api('/api/config', { method: 'POST', body: JSON.stringify({ outboundUrl }) })
})

document.getElementById('send-test').addEventListener('click', async () => {
  await api('/api/test-outbound', { method: 'POST', body: JSON.stringify({ test: true, firedAt: new Date().toISOString() }) })
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
    ? entries.map((e) => `<div class="log-entry ${e.status}"><span class="tag">${e.direction} · ${e.status}${e.statusCode ? ' · ' + e.statusCode : ''} · ${e.at}</span><br/>${e.summary}</div>`).join('')
    : '<p class="sub">No webhook activity yet.</p>'
}

async function init() {
  gate.hidden = true
  app.hidden = false
  const config = await api('/api/config')
  document.getElementById('outbound-url').value = config.outboundUrl || ''
  document.getElementById('inbound-url').value = `${location.origin}/webhook`
  addMappingUI('outbound-mapping', config.outboundMappings)
  addMappingUI('inbound-mapping', config.inboundMappings)
  await refreshLog()
  setInterval(refreshLog, 5000)
}

if (token) init()
