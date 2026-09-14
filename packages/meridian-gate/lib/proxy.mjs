// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A plain HTTP/HTTPS forward proxy. Point your AI SDK's HTTPS_PROXY /
// HTTP_PROXY at this instead of the network directly, and Gate becomes the
// only path an outbound call can take off the machine.
//
// HTTPS (the case that matters — every AI API is HTTPS) arrives as a
// CONNECT request naming the destination host:port *before* any TLS or
// application data is sent. Gate decides allow/block on that CONNECT line
// alone; it never terminates or inspects the TLS session, so customer
// data and API payloads inside an allowed tunnel stay opaque to Gate too.
// It is a gate on *whether a call happens at all*, not a content inspector.

import { createServer } from 'node:http'
import { connect as netConnect } from 'node:net'
import { loadConfig, findRule } from './config.mjs'
import { appendEvent } from './chain.mjs'

/**
 * @param {string} hostHeader e.g. "api.openai.com:443"
 * @returns {{ host: string, port: number }}
 */
function parseHostPort(hostHeader, defaultPort) {
  const idx = hostHeader.lastIndexOf(':')
  if (idx === -1) return { host: hostHeader, port: defaultPort }
  const port = Number(hostHeader.slice(idx + 1))
  if (!Number.isFinite(port)) return { host: hostHeader, port: defaultPort }
  return { host: hostHeader.slice(0, idx), port }
}

/**
 * @param {{ configPath?: string, logPath?: string, onDecision?: (d: {action: 'allow'|'block', host: string}) => void }} [opts]
 */
export function createGateServer(opts = {}) {
  const { configPath, logPath, onDecision } = opts

  function decide(rawHost) {
    const config = loadConfig(configPath)
    const { host } = parseHostPort(rawHost, 443)
    const rule = findRule(config, host)
    const action = rule ? 'allow' : 'block'
    appendEvent(
      {
        action,
        host: host.toLowerCase(),
        by: rule ? rule.addedBy : null,
        detail: rule ? rule.note : 'no matching rule — default is no',
      },
      logPath,
    )
    onDecision?.({ action, host: host.toLowerCase() })
    return action === 'allow'
  }

  const server = createServer((req, res) => {
    // Plain-HTTP proxying (rare for AI APIs, but a proxy that only handles
    // CONNECT isn't a real proxy — this keeps curl/testing paths honest too).
    let targetHost = req.headers.host
    if (!targetHost) {
      res.writeHead(400)
      res.end('Bad request: missing Host header.')
      return
    }

    if (!decide(targetHost)) {
      res.writeHead(403, { 'content-type': 'text/plain' })
      res.end(`Meridian Gate: ${targetHost} is not on the allowlist. Default is no.\n`)
      return
    }

    res.writeHead(502, { 'content-type': 'text/plain' })
    res.end('Meridian Gate: host allowed, but plain-HTTP forwarding is not implemented — use HTTPS.\n')
  })

  server.on('connect', (req, clientSocket, head) => {
    const targetHeader = req.url // "host:port"
    if (!targetHeader) {
      clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      return
    }

    if (!decide(targetHeader)) {
      clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\nMeridian Gate: destination is not on the allowlist. Default is no.\r\n')
      return
    }

    const { host, port } = parseHostPort(targetHeader, 443)
    const serverSocket = netConnect(port, host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      serverSocket.write(head)
      serverSocket.pipe(clientSocket)
      clientSocket.pipe(serverSocket)
    })

    serverSocket.on('error', () => clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'))
    clientSocket.on('error', () => serverSocket.end())
  })

  return server
}

export { parseHostPort }
