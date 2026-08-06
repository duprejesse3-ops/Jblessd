// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Fixture site used by the test suite.
//
// Two variants of one site, selected by the `quality` argument, served on an
// ephemeral port so tests never collide with a real dev server:
//
//   'bad'   deliberately broken — no meta description, no Open Graph tags, no
//           sitemap, a soft 404, a dead internal link, images with no alt text
//   'good'  everything the engine looks for, except HTTPS (plain http locally)
//
// Exported as a function rather than a script so the test runner can start and
// stop it in-process.

import { createServer } from 'node:http'

const IMAGE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function badHtml() {
  return {
    '/': `<!doctype html>
<html><head><title>Shop</title></head><body>
<h1>Shop</h1>
<img src="/a.png">
<img src="/b.png">
<a href="/about">About</a>
<a href="/dead-link">Deals</a>
</body></html>`,
    '/about': `<!doctype html>
<html><head><title>About</title></head><body>
<h1>About</h1><img src="/c.png">
<a href="/">Home</a>
</body></html>`,
  }
}

function goodHtml(origin) {
  const head = (title, description, path) => `
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${origin}${path}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${origin}/social.png">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Fixture Store"}
</script>`

  return {
    '/': `<!doctype html>
<html><head>${head(
      'Fixture Store — everything the auditor wants',
      'A fixture site that satisfies every generic check the audit engine performs, used to verify the passing path.',
      '/',
    )}</head><body>
<h1>Fixture Store</h1>
<img src="/a.png" alt="A product">
<a href="/about">About</a>
</body></html>`,
    '/about': `<!doctype html>
<html><head>${head(
      'About the Fixture Store and its purpose',
      'The about page for the fixture site, long enough to satisfy the meta description length check comfortably.',
      '/about',
    )}</head><body>
<h1>About</h1><img src="/c.png" alt="Our office">
<a href="/">Home</a>
</body></html>`,
  }
}

/**
 * Start a fixture site. Resolves once it is listening.
 *
 * @param {'good'|'bad'} quality
 * @returns {Promise<{origin: string, close: () => Promise<void>}>}
 */
export function startFixture(quality) {
  const good = quality === 'good'

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const origin = `http://127.0.0.1:${server.address().port}`
      const pages = good ? goodHtml(origin) : badHtml()
      const path = new URL(req.url, origin).pathname

      const html = (body, status = 200) => {
        const headers = { 'content-type': 'text/html; charset=utf-8' }
        if (good) {
          headers['strict-transport-security'] = 'max-age=31536000'
          headers['x-content-type-options'] = 'nosniff'
          headers['content-security-policy'] = "default-src 'self'"
          headers['referrer-policy'] = 'strict-origin-when-cross-origin'
        }
        res.writeHead(status, headers)
        res.end(body)
      }

      if (pages[path]) return html(pages[path])

      if (path === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' })
        return res.end(good ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\n')
      }

      if (path === '/sitemap.xml') {
        if (!good) {
          res.writeHead(404)
          return res.end('not found')
        }
        res.writeHead(200, { 'content-type': 'application/xml' })
        return res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${origin}/</loc></url>
<url><loc>${origin}/about</loc></url>
</urlset>`)
      }

      if (path.endsWith('.png')) {
        res.writeHead(200, { 'content-type': 'image/png' })
        return res.end(IMAGE_BYTES)
      }

      if (path === '/dead-link') {
        res.writeHead(500, { 'content-type': 'text/html' })
        return res.end('<h1>broken</h1>')
      }

      // The soft 404: the bad site answers 200 for anything unknown.
      if (good) {
        res.writeHead(404, { 'content-type': 'text/html' })
        return res.end('<!doctype html><title>Not found</title><h1>404</h1>')
      }
      return html('<!doctype html><title>Shop</title><h1>Nothing here</h1>', 200)
    })

    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      })
    })
  })
}
