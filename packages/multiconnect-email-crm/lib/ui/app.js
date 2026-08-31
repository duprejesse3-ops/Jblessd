// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mce-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mce-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mce-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-safe').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({ safeMode: document.getElementById('safe-mode').value, sendLimitPerHour: Number(document.getElementById('send-limit').value) }),
  })
  await refreshConfig()
})

document.getElementById('save-smtp').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      smtp: {
        host: document.getElementById('smtp-host').value.trim(),
        port: Number(document.getElementById('smtp-port').value),
        user: document.getElementById('smtp-user').value.trim(),
        pass: document.getElementById('smtp-pass').value.trim(),
        fromAddress: document.getElementById('from-address').value.trim(),
        fromName: document.getElementById('from-name').value.trim(),
      },
    }),
  })
  document.getElementById('smtp-pass').value = ''
  await refreshConfig()
})

document.getElementById('add-contact').addEventListener('click', async () => {
  const name = document.getElementById('contact-name').value.trim()
  const email = document.getElementById('contact-email').value.trim()
  if (!email) return
  const data = await api('/api/contacts', { method: 'POST', body: JSON.stringify({ name, email }) })
  if (!data.error) {
    document.getElementById('contact-name').value = ''
    document.getElementById('contact-email').value = ''
  }
  await refreshContacts()
  await refreshLog()
})

async function refreshContacts() {
  const { contacts } = await api('/api/contacts')
  const el = document.getElementById('contacts')
  el.innerHTML = contacts.length
    ? contacts.map((c) => `<div class="contact">${c.name ? c.name + ' — ' : ''}${c.email}</div>`).join('')
    : '<p class="sub">No contacts yet.</p>'
}

async function refreshDrafts() {
  const { drafts } = await api('/api/drafts')
  const el = document.getElementById('drafts')
  el.innerHTML = drafts.length
    ? drafts.map((d) => `
      <div class="draft">
        <div class="meta">To: ${d.to} · <span class="status ${d.status}">${d.status}</span></div>
        <strong>${d.subject}</strong>
        <p class="sub">${(d.text || '').slice(0, 140)}</p>
        ${d.status === 'pending' ? `
          <button data-approve="${d.id}">Approve &amp; send</button>
          <button class="danger" data-reject="${d.id}">Reject</button>
        ` : ''}
      </div>
    `).join('')
    : '<p class="sub">No drafts yet.</p>'

  el.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const data = await api(`/api/drafts/${btn.dataset.approve}/approve`, { method: 'POST' })
      if (data.error) alert(data.error)
      await refreshDrafts()
      await refreshLog()
    })
  })
  el.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/drafts/${btn.dataset.reject}/reject`, { method: 'POST' })
      await refreshDrafts()
      await refreshLog()
    })
  })
}

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
  document.getElementById('safe-mode').value = config.safeMode
  document.getElementById('send-limit').value = config.sendLimitPerHour
  const badge = document.getElementById('safe-badge')
  badge.textContent = config.safeMode
  badge.className = `safe-badge ${config.safeMode === 'read-write' ? 'rw' : 'ro'}`

  document.getElementById('smtp-host').value = config.smtp.host || ''
  document.getElementById('smtp-port').value = config.smtp.port || 465
  document.getElementById('smtp-user').value = config.smtp.user || ''
  document.getElementById('from-address').value = config.smtp.fromAddress || ''
  document.getElementById('from-name').value = config.smtp.fromName || ''

  document.getElementById('inbound-url').value = `${location.origin}/webhook/inbound-email?secret=${config.inboundSecret}`
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
  await refreshDrafts()
  await refreshContacts()
  await refreshLog()
  setInterval(() => { refreshDrafts(); refreshLog() }, 5000)
}

if (token) init()
