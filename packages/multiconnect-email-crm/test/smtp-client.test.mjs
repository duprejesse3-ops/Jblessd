// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.
//
// Runs the real SMTP client against a small fake SMTP server (plain
// node:net, no TLS) that speaks enough of RFC 5321 to exercise the actual
// EHLO/AUTH/MAIL FROM/RCPT TO/DATA sequence. This tests protocol
// correctness, not encryption — connectFn injection is what lets the test
// point at a plaintext fixture instead of a real mail server.

import assert from 'node:assert/strict'
import test from 'node:test'
import net from 'node:net'
import { sendMail, SmtpError } from '../lib/smtp-client.mjs'

/**
 * A minimal fake SMTP server. `behavior` can override how it responds to
 * specific commands, to test failure paths (bad auth, rejected recipient).
 */
function startFakeSmtp(behavior = {}) {
  const received = { commands: [], dataBody: '' }
  const server = net.createServer((socket) => {
    let stage = 'greeting'
    let dataBuf = ''
    socket.write('220 fake.smtp.test ESMTP\r\n')

    socket.on('data', (chunk) => {
      const text = chunk.toString('utf8')

      if (stage === 'data') {
        dataBuf += text
        if (dataBuf.endsWith('\r\n.\r\n')) {
          received.dataBody = dataBuf.slice(0, -5)
          stage = 'ready'
          socket.write(behavior.dataResponse ?? '250 OK message accepted\r\n')
        }
        return
      }

      const line = text.trim()
      received.commands.push(line)

      if (/^EHLO/i.test(line)) {
        socket.write('250-fake.smtp.test\r\n250 AUTH LOGIN\r\n')
      } else if (/^AUTH LOGIN/i.test(line)) {
        stage = 'auth-user'
        socket.write('334 VXNlcm5hbWU6\r\n')
      } else if (stage === 'auth-user') {
        stage = 'auth-pass'
        socket.write('334 UGFzc3dvcmQ6\r\n')
      } else if (stage === 'auth-pass') {
        stage = 'ready'
        socket.write(behavior.authResponse ?? '235 Authentication successful\r\n')
      } else if (/^MAIL FROM/i.test(line)) {
        socket.write(behavior.mailFromResponse ?? '250 OK\r\n')
      } else if (/^RCPT TO/i.test(line)) {
        socket.write(behavior.rcptResponse ?? '250 OK\r\n')
      } else if (/^DATA/i.test(line)) {
        stage = 'data'
        socket.write('354 Start mail input\r\n')
      } else if (/^QUIT/i.test(line)) {
        socket.write('221 Bye\r\n')
        socket.end()
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port, received }))
  })
}

function testConfig(port, overrides = {}) {
  return {
    smtp: {
      host: '127.0.0.1',
      port,
      secure: false,
      user: 'testuser',
      pass: 'testpass',
      fromAddress: 'me@example.com',
      fromName: 'Test Sender',
      ...overrides,
    },
  }
}

test('sendMail completes a full send against a well-behaved server', async () => {
  const { server, port, received } = await startFakeSmtp()
  try {
    const result = await sendMail(testConfig(port), { to: 'you@example.com', subject: 'Hello', text: 'Hi there' })
    assert.equal(result.ok, true)
    assert.ok(received.commands.some((c) => /^MAIL FROM:<me@example.com>/i.test(c)))
    assert.ok(received.commands.some((c) => /^RCPT TO:<you@example.com>/i.test(c)))
    assert.match(received.dataBody, /Subject: Hello/)
    assert.match(received.dataBody, /Hi there/)
  } finally {
    server.close()
  }
})

test('sendMail throws when SMTP is not configured', async () => {
  await assert.rejects(
    () => sendMail({ smtp: { host: null, user: null, pass: null, fromAddress: null } }, { to: 'x@example.com', subject: 'x', text: 'x' }),
    (err) => err instanceof SmtpError && /not configured/.test(err.message),
  )
})

test('sendMail throws a clear error when authentication fails', async () => {
  const { server, port } = await startFakeSmtp({ authResponse: '535 Authentication failed\r\n' })
  try {
    await assert.rejects(
      () => sendMail(testConfig(port), { to: 'you@example.com', subject: 'Hi', text: 'x' }),
      (err) => err instanceof SmtpError && err.code === 535,
    )
  } finally {
    server.close()
  }
})

test('sendMail throws a clear error when the recipient is rejected', async () => {
  const { server, port } = await startFakeSmtp({ rcptResponse: '550 No such user\r\n' })
  try {
    await assert.rejects(
      () => sendMail(testConfig(port), { to: 'nobody@example.com', subject: 'Hi', text: 'x' }),
      (err) => err instanceof SmtpError && err.code === 550,
    )
  } finally {
    server.close()
  }
})

test('sendMail escapes a lone-dot line in the message body', async () => {
  const { server, port, received } = await startFakeSmtp()
  try {
    await sendMail(testConfig(port), { to: 'you@example.com', subject: 'Dots', text: 'Line one\n.\nLine three' })
    // The escaped ".." should appear where the lone "." was, and the raw
    // terminator sequence should never appear inside the transmitted body.
    assert.match(received.dataBody, /Line one\n\.\.\nLine three/)
    assert.doesNotMatch(received.dataBody.replace(/\.\.\r?\n/g, ''), /^\.\r?\n/m)
  } finally {
    server.close()
  }
})

test('sendMail includes both text and html parts when html is given', async () => {
  const { server, port, received } = await startFakeSmtp()
  try {
    await sendMail(testConfig(port), { to: 'you@example.com', subject: 'Rich', text: 'plain', html: '<b>bold</b>' })
    assert.match(received.dataBody, /multipart\/alternative/)
    assert.match(received.dataBody, /<b>bold<\/b>/)
  } finally {
    server.close()
  }
})
