// Bridge between Node's http module and the WHATWG Request/Response objects
// the application handlers are written against.
//
// Every function and edge function in this codebase already has the signature
// `(req: Request, context) => Response`, which is the whole reason the source
// runs unmodified off Netlify. This file is the only place that knows about
// Node's IncomingMessage and ServerResponse.

import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** Builds the absolute URL for an incoming request. */
function absoluteUrl(req, trustProxy) {
  const forwardedProto = trustProxy ? req.headers['x-forwarded-proto'] : null
  const proto = (forwardedProto || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim()

  const forwardedHost = trustProxy ? req.headers['x-forwarded-host'] : null
  const host = (forwardedHost || req.headers.host || 'localhost').split(',')[0].trim()

  return new URL(req.url, `${proto}://${host}`)
}

export function toWebRequest(req, { trustProxy = false } = {}) {
  const url = absoluteUrl(req, trustProxy)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const v of value) headers.append(key, v)
    else headers.set(key, value)
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    // Required by undici whenever a stream body is supplied.
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  })
}

export async function sendWebResponse(res, response) {
  if (res.writableEnded) return

  const headers = {}
  for (const [key, value] of response.headers) {
    // Set-Cookie is the one header that legitimately repeats; collapsing it
    // into a comma-joined string would break every cookie after the first.
    if (key.toLowerCase() === 'set-cookie') continue
    headers[key] = value
  }

  const cookies = response.headers.getSetCookie?.() ?? []
  if (cookies.length) headers['set-cookie'] = cookies

  res.writeHead(response.status, headers)

  if (!response.body) {
    res.end()
    return
  }

  try {
    // pipeline (not .pipe) so a mid-stream failure rejects here instead of
    // surfacing as an unhandled stream error event.
    await pipeline(Readable.fromWeb(response.body), res)
  } catch {
    // The client hanging up mid-stream is normal, not an error worth logging.
    if (!res.writableEnded) res.end()
  }
}

/** Small helper for the error and not-found paths. */
export function textResponse(status, body, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...extraHeaders },
  })
}
