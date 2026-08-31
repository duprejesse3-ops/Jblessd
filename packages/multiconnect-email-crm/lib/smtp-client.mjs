// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A minimal SMTP client speaking just enough of RFC 5321 to authenticate
// and send one message: connect, EHLO, AUTH LOGIN, MAIL FROM, RCPT TO,
// DATA, QUIT. No dependency on nodemailer or anything else — plain
// node:net/node:tls, because the whole package stays at zero dependencies.
//
// Connection is injectable (see `connectFn` below) specifically so the test
// suite can point this at a local plaintext fixture server instead of a
// real mail server — the protocol logic is what's under test, not TLS.

import net from 'node:net'
import tls from 'node:tls'

const RESPONSE_TIMEOUT_MS = 10_000

export class SmtpError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'SmtpError'
    this.code = code
  }
}

/** Reads one SMTP response (possibly multi-line, "250-..." then "250 ..."). */
function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => {
      socket.removeListener('data', onData)
      reject(new SmtpError('Timed out waiting for SMTP server response', null))
    }, RESPONSE_TIMEOUT_MS)

    function onData(chunk) {
      buf += chunk.toString('utf8')
      const lines = buf.split('\r\n').filter(Boolean)
      const last = lines[lines.length - 1]
      // A final line has a space after the 3-digit code; "-" means more lines follow.
      if (last && /^\d{3} /.test(last)) {
        clearTimeout(timer)
        socket.removeListener('data', onData)
        const code = Number(last.slice(0, 3))
        resolve({ code, text: buf })
      }
    }
    socket.on('data', onData)
  })
}

function writeLine(socket, line) {
  socket.write(line + '\r\n')
}

async function expect(socket, expectedCode, label) {
  const res = await readResponse(socket)
  if (res.code !== expectedCode) {
    throw new SmtpError(`SMTP ${label} failed: expected ${expectedCode}, got ${res.code} (${res.text.trim()})`, res.code)
  }
  return res
}

function buildMessage({ from, fromName, to, subject, text, html }) {
  const fromHeader = fromName ? `"${fromName}" <${from}>` : from
  const date = new Date().toUTCString()
  const boundary = `----mc-email-${Date.now()}`
  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
  ]

  let body
  if (html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    body =
      `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text ?? ''}\r\n` +
      `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n--${boundary}--`
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8')
    body = text ?? ''
  }

  // Per RFC 5321, a line consisting of a single "." must be escaped by
  // doubling it, since a lone "." on its own line terminates the DATA block.
  const escaped = body.replace(/^\./gm, '..')
  return `${headers.join('\r\n')}\r\n\r\n${escaped}`
}

/**
 * Send one email over SMTP. Does not check safe mode itself — the caller
 * (the approval queue) is where that gate belongs, since this function's
 * whole job is "actually send", which by definition only ever runs after
 * a human has approved a queued draft.
 *
 * @param {import('./config.mjs').EmailConfig} config
 * @param {{ to: string, subject: string, text?: string, html?: string }} message
 * @param {{ connectFn?: (opts: object) => import('node:net').Socket }} [opts]
 */
export async function sendMail(config, message, opts = {}) {
  const { smtp } = config
  if (!smtp.host || !smtp.user || !smtp.pass || !smtp.fromAddress) {
    throw new SmtpError('SMTP is not configured yet — set host, user, password, and a from address first.', null)
  }

  const connect = opts.connectFn ?? ((connectOpts) =>
    smtp.secure
      ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host, ...connectOpts })
      : net.connect({ host: smtp.host, port: smtp.port, ...connectOpts }))

  const socket = connect({})

  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('secureConnect', resolve)
      socket.once('error', reject)
    })

    await expect(socket, 220, 'greeting')
    writeLine(socket, `EHLO ${smtp.host}`)
    await expect(socket, 250, 'EHLO')

    writeLine(socket, 'AUTH LOGIN')
    await expect(socket, 334, 'AUTH LOGIN prompt')
    writeLine(socket, Buffer.from(smtp.user, 'utf8').toString('base64'))
    await expect(socket, 334, 'username')
    writeLine(socket, Buffer.from(smtp.pass, 'utf8').toString('base64'))
    await expect(socket, 235, 'authentication')

    writeLine(socket, `MAIL FROM:<${smtp.fromAddress}>`)
    await expect(socket, 250, 'MAIL FROM')
    writeLine(socket, `RCPT TO:<${message.to}>`)
    await expect(socket, 250, 'RCPT TO')

    writeLine(socket, 'DATA')
    await expect(socket, 354, 'DATA')
    const raw = buildMessage({
      from: smtp.fromAddress,
      fromName: smtp.fromName,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    writeLine(socket, `${raw}\r\n.`)
    await expect(socket, 250, 'message body')

    writeLine(socket, 'QUIT')
    // Best-effort — a slow/missing QUIT response shouldn't fail a send
    // that has already been accepted by the server.
    await readResponse(socket).catch(() => {})

    return { ok: true }
  } finally {
    socket.destroy()
  }
}
