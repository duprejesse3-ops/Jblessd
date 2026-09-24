// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcd-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcd-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcd-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-safe').addEventListener('click', async () => {
  await api('/api/config', { method: 'POST', body: JSON.stringify({ safeMode: document.getElementById('safe-mode').value }) })
  await refreshConfig()
})

document.getElementById('save-slack').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({ slack: { enabled: true, signingSecret: document.getElementById('slack-secret').value.trim() } }),
  })
  document.getElementById('slack-secret').value = ''
  await refreshConfig()
})

document.getElementById('save-discord').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({ discord: { enabled: true, publicKey: document.getElementById('discord-key').value.trim() } }),
  })
  document.getElementById('discord-key').value = ''
  await refreshConfig()
})

document.getElementById('add-route').addEventListener('click', async () => {
  const name = document.getElementById('route-name').value.trim()
  const slackWebhookUrl = document.getElementById('route-slack').value.trim()
  const discordWebhookUrl = document.getElementById('route-discord').value.trim()
  const data = await api('/api/routes', { method: 'POST', body: JSON.stringify({ name, slackWebhookUrl, discordWebhookUrl }) })
  if (!data.error) {
    document.getElementById('route-name').value = ''
    document.getElementById('route-slack').value = ''
    document.getElementById('route-discord').value = ''
  }
  await refreshRoutes()
})

document.getElementById('send-test').addEventListener('click', async () => {
  const routeId = document.getElementById('test-route').value
  const message = document.getElementById('test-message').value.trim()
  const el = document.getElementById('test-result')
  if (!routeId || !message) { el.textContent = 'Pick a route and enter a message.'; return }
  const data = await api('/api/post', { method: 'POST', body: JSON.stringify({ routeId, message }) })
  el.textContent = data.error ? `Error: ${data.error}` : 'Sent.'
  await refreshLog()
})

async function refreshRoutes() {
  const { routes } = await api('/api/routes')
  const el = document.getElementById('routes')
  el.innerHTML = routes.length
    ? routes.map((r) => `
      <div class="route">
        <strong>${r.name}</strong>
        <div class="meta">${r.slackWebhookUrl ? 'Slack ✓' : ''} ${r.discordWebhookUrl ? 'Discord ✓' : ''}</div>
        <button class="danger" data-remove="${r.id}">Remove</button>
      </div>
    `).join('')
    : '<p class="sub">No routes yet.</p>'
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/routes/${btn.dataset.remove}`, { method: 'DELETE' })
      await refreshRoutes()
    })
  })

  const select = document.getElementById('test-route')
  select.innerHTML = routes.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')
}

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
  document.getElementById('slack-url').value = `${location.origin}/webhook/slack`
  document.getElementById('discord-url').value = `${location.origin}/webhook/discord`
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
  await refreshRoutes()
  await refreshLog()
  setInterval(refreshLog, 5000)
}

if (token) init()
