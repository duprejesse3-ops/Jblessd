// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcsa-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcsa-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcsa-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-safe').addEventListener('click', async () => {
  await api('/api/config', { method: 'POST', body: JSON.stringify({ safeMode: document.getElementById('safe-mode').value }) })
  await refreshConfig()
})

document.getElementById('save-sheets').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      sheets: {
        enabled: document.getElementById('sheets-enabled').checked,
        serviceAccountEmail: document.getElementById('sa-email').value.trim(),
        privateKey: document.getElementById('sa-key').value.trim(),
        spreadsheetId: document.getElementById('spreadsheet-id').value.trim(),
        sheetName: document.getElementById('sheet-name').value.trim() || 'Sheet1',
      },
    }),
  })
  document.getElementById('sa-key').value = ''
  await refreshConfig()
})

document.getElementById('save-airtable').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      airtable: {
        enabled: document.getElementById('airtable-enabled').checked,
        apiKey: document.getElementById('at-key').value.trim(),
        baseId: document.getElementById('at-base').value.trim(),
        tableName: document.getElementById('at-table').value.trim(),
      },
    }),
  })
  document.getElementById('at-key').value = ''
  await refreshConfig()
})

document.getElementById('sheets-test').addEventListener('click', async () => {
  const el = document.getElementById('sheets-result')
  el.textContent = 'Fetching…'
  const data = await api('/api/sheets/rows')
  el.textContent = data.error ? `Error: ${data.error}` : `Fetched ${data.rows.length} rows, columns: ${data.headers.join(', ')}`
  await refreshLog()
})
document.getElementById('airtable-test').addEventListener('click', async () => {
  const el = document.getElementById('airtable-result')
  el.textContent = 'Fetching…'
  const data = await api('/api/airtable/records')
  el.textContent = data.error ? `Error: ${data.error}` : `Fetched ${data.records.length} records.`
  await refreshLog()
})

function mappingRow(rule) {
  const row = document.createElement('div')
  row.className = 'row'
  row.innerHTML = `
    <input placeholder="source field" value="${rule.sourcePath ?? ''}" data-field="sourcePath"/>
    <span class="tag">→</span>
    <input placeholder="target field" value="${rule.targetField ?? ''}" data-field="targetField"/>
    <button class="ghost" data-remove>×</button>
  `
  row.querySelector('[data-remove]').addEventListener('click', () => row.remove())
  return row
}
function readRules(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .row`)).map((row, i) => ({
    id: String(i),
    sourcePath: row.querySelector('[data-field="sourcePath"]').value.trim(),
    targetField: row.querySelector('[data-field="targetField"]').value.trim(),
  })).filter((r) => r.sourcePath && r.targetField)
}
function addMappingUI(containerId, rules) {
  const container = document.getElementById(containerId)
  container.innerHTML = ''
  for (const rule of rules) container.appendChild(mappingRow(rule))
}
document.getElementById('add-read-rule').addEventListener('click', () => document.getElementById('read-mapping').appendChild(mappingRow({})))
document.getElementById('add-write-rule').addEventListener('click', () => document.getElementById('write-mapping').appendChild(mappingRow({})))
document.getElementById('save-read-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'read', rules: readRules('read-mapping') }) })
})
document.getElementById('save-write-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'write', rules: readRules('write-mapping') }) })
})

document.getElementById('clear-log').addEventListener('click', async () => {
  await api('/api/log/clear', { method: 'POST' })
  await refreshLog()
})
async function refreshLog() {
  const { entries } = await api('/api/log?limit=50')
  const el = document.getElementById('log')
  el.innerHTML = entries.length
    ? entries.map((e) => `<div class="log-entry ${e.kind === 'error' ? 'error' : ''}"><span class="tag">${e.platform} · ${e.kind} · ${e.at}</span><br/>${e.summary}</div>`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function refreshConfig() {
  const config = await api('/api/config')
  document.getElementById('safe-mode').value = config.safeMode
  const badge = document.getElementById('safe-badge')
  badge.textContent = config.safeMode
  badge.className = `safe-badge ${config.safeMode === 'read-write' ? 'rw' : 'ro'}`

  document.getElementById('sheets-enabled').checked = config.sheets.enabled
  document.getElementById('sa-email').value = config.sheets.serviceAccountEmail || ''
  document.getElementById('spreadsheet-id').value = config.sheets.spreadsheetId || ''
  document.getElementById('sheet-name').value = config.sheets.sheetName || 'Sheet1'

  document.getElementById('airtable-enabled').checked = config.airtable.enabled
  document.getElementById('at-base').value = config.airtable.baseId || ''
  document.getElementById('at-table').value = config.airtable.tableName || ''

  addMappingUI('read-mapping', config.readMappings || [])
  addMappingUI('write-mapping', config.writeMappings || [])
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
  await refreshLog()
  setInterval(refreshLog, 5000)
}

if (token) init()
