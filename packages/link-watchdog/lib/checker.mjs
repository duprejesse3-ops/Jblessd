// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Checks one URL and classifies the result. HEAD first (cheap — no response
// body to download), falling back to GET when a server doesn't support HEAD
// (405/501, or a straight transport failure on the HEAD attempt itself —
// some servers hang up rather than reply with a status code). `fetchFn` is
// injectable so the test suite exercises every branch with a fake
// implementation and never touches the network.

/**
 * @param {number} status
 * @returns {'ok'|'redirect'|'client_error'|'server_error'|'unknown'}
 */
export function classifyStatus(status) {
  if (status >= 200 && status < 300) return 'ok'
  if (status >= 300 && status < 400) return 'redirect'
  if (status >= 400 && status < 500) return 'client_error'
  if (status >= 500 && status < 600) return 'server_error'
  return 'unknown'
}

function isTimeout(error) {
  return error?.name === 'TimeoutError' || error?.name === 'AbortError'
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn]
 * @param {number} [options.timeoutMs=8000]
 * @param {string} [options.userAgent]
 * @returns {Promise<{url:string, method:'HEAD'|'GET', status:number|null,
 *   classification:string, finalUrl:string, error:string|null}>}
 */
export async function checkUrl(url, { fetchFn = fetch, timeoutMs = 8000, userAgent = 'link-watchdog/1.0' } = {}) {
  const headers = { 'user-agent': userAgent }

  try {
    const res = await fetchFn(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Some servers answer HEAD with "not allowed"/"not implemented" rather
    // than simply refusing the connection — that is the documented signal
    // to retry with GET, not a broken link.
    if (res.status === 405 || res.status === 501) {
      return await getFallback(url, { fetchFn, timeoutMs, userAgent })
    }
    return {
      url,
      method: 'HEAD',
      status: res.status,
      classification: classifyStatus(res.status),
      finalUrl: res.url || url,
      error: null,
    }
  } catch (error) {
    if (isTimeout(error)) {
      // A HEAD timeout usually means a GET will time out too, but it costs
      // one more bounded request to be sure rather than reporting a
      // false positive against a server that just doesn't like HEAD.
      return await getFallback(url, { fetchFn, timeoutMs, userAgent })
    }
    return await getFallback(url, { fetchFn, timeoutMs, userAgent })
  }
}

async function getFallback(url, { fetchFn, timeoutMs, userAgent }) {
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    })
    return {
      url,
      method: 'GET',
      status: res.status,
      classification: classifyStatus(res.status),
      finalUrl: res.url || url,
      error: null,
    }
  } catch (error) {
    return {
      url,
      method: 'GET',
      status: null,
      classification: isTimeout(error) ? 'timeout' : 'unreachable',
      finalUrl: url,
      error: error?.message ?? String(error),
    }
  }
}
