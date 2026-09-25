// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a flat list of checked links into a report object, then into the
// HTML email digest and a plain-text summary. Kept separate from the crawl
// so the report shape has its own tests independent of any network call.

const BROKEN_CLASSES = new Set(['client_error', 'server_error', 'timeout', 'unreachable'])
const COUNT_KEYS = ['ok', 'redirect', 'client_error', 'server_error', 'timeout', 'unreachable', 'unknown']

/**
 * @param {Array<{url:string, foundOn:string, status:number|null,
 *   classification:string, method:string, error:string|null}>} checked
 * @param {object} [meta]
 * @param {string} [meta.siteName]
 * @param {string} [meta.sitemapUrl]
 * @returns {object} report
 */
export function buildReport(checked, meta = {}) {
  const counts = Object.fromEntries(COUNT_KEYS.map((k) => [k, 0]))
  const broken = []

  for (const entry of checked) {
    counts[entry.classification] = (counts[entry.classification] ?? 0) + 1
    if (BROKEN_CLASSES.has(entry.classification)) broken.push(entry)
  }

  // Worst problems first: a dead page (server/unreachable) matters more than
  // a 404 on a link buried three clicks deep, and grouping like this keeps a
  // long report skimmable.
  const severity = { server_error: 0, unreachable: 1, timeout: 2, client_error: 3 }
  broken.sort((a, b) => (severity[a.classification] ?? 9) - (severity[b.classification] ?? 9))

  return {
    generatedAt: new Date().toISOString(),
    siteName: meta.siteName ?? null,
    sitemapUrl: meta.sitemapUrl ?? null,
    totalChecked: checked.length,
    counts,
    brokenCount: broken.length,
    broken,
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

const CLASS_LABEL = {
  client_error: 'Client error (4xx)',
  server_error: 'Server error (5xx)',
  timeout: 'Timed out',
  unreachable: 'Unreachable',
}

/**
 * @param {object} report  from buildReport()
 * @returns {string} plain-text summary, used for the email fallback and the
 *   Slack message
 */
export function buildSummaryText(report) {
  const lines = [
    `Link & uptime check${report.siteName ? ` — ${report.siteName}` : ''}`,
    `${report.totalChecked} link(s) checked, ${report.brokenCount} broken.`,
    '',
  ]
  if (!report.brokenCount) {
    lines.push('Nothing broken this run.')
    return lines.join('\n')
  }
  for (const entry of report.broken.slice(0, 25)) {
    lines.push(
      `- [${CLASS_LABEL[entry.classification] ?? entry.classification}] ${entry.url}` +
        `${entry.status ? ` (HTTP ${entry.status})` : entry.error ? ` (${entry.error})` : ''}` +
        ` — found on ${entry.foundOn}`,
    )
  }
  if (report.broken.length > 25) lines.push(`…and ${report.broken.length - 25} more.`)
  return lines.join('\n')
}

/**
 * @param {object} report  from buildReport()
 * @returns {string} a self-contained HTML email body
 */
export function buildEmailHtml(report) {
  const title = `Link & uptime check${report.siteName ? ` — ${escapeHtml(report.siteName)}` : ''}`
  const countRow = (label, key, color) =>
    `<td style="padding:8px 14px;text-align:center;"><div style="font-size:20px;font-weight:700;color:${color};">${report.counts[key]}</div><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em;">${label}</div></td>`

  const rows = report.broken
    .map(
      (entry) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;color:#a33;white-space:nowrap;">${escapeHtml(CLASS_LABEL[entry.classification] ?? entry.classification)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;word-break:break-all;"><a href="${escapeHtml(entry.url)}" style="color:#1a4b8c;">${escapeHtml(entry.url)}</a></td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;color:#666;">${entry.status ?? escapeHtml(entry.error ?? '')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;color:#666;word-break:break-all;">${escapeHtml(entry.foundOn)}</td>
      </tr>`,
    )
    .join('')

  const body = report.brokenCount
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#f6f6f6;">
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Type</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">URL</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Status</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Found on</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<p style="color:#2a7a2a;font-size:14px;">Nothing broken this run.</p>`

  return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;max-width:680px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 4px;">${title}</h1>
    <p style="font-size:13px;color:#666;margin:0 0 16px;">${escapeHtml(report.generatedAt)}${report.sitemapUrl ? ` &middot; ${escapeHtml(report.sitemapUrl)}` : ''}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;">
      <tr>
        ${countRow('OK', 'ok', '#2a7a2a')}
        ${countRow('Redirect', 'redirect', '#b8860b')}
        ${countRow('4xx', 'client_error', '#a33')}
        ${countRow('5xx', 'server_error', '#a33')}
        ${countRow('Timeout', 'timeout', '#a33')}
        ${countRow('Unreachable', 'unreachable', '#a33')}
      </tr>
    </table>
    ${body}
    <p style="font-size:11px;color:#999;margin-top:24px;">link-watchdog checked ${report.totalChecked} link(s) starting from ${report.sitemapUrl ? escapeHtml(report.sitemapUrl) : 'the configured sitemap'}.</p>
  </body>
</html>`
}
