// The code workspace: the site's own development environment.
//
// This is the piece that makes the deployed site self-hosting in the fullest
// sense. The storefront already runs entirely on Netlify — but changing it meant
// a laptop, a checkout, a toolchain, and (for trying something without deploying
// it) a container that not every machine will cooperate with. Everything in this
// module exists so that loop can happen inside the site instead: source is
// written in a browser at /code, stored here, and served straight back at
// /p/<slug>. A phone is a sufficient computer for the whole cycle.
//
// Two invariants shape the code below.
//
//   * **Nothing arbitrary reaches disk or the routing table.** Paths and slugs
//     are validated against allowlists rather than sanitised, sizes are capped,
//     and every write is scoped to one app row. A workspace that can be talked
//     into writing `../../netlify.toml` would be a deploy-time remote shell.
//   * **Served apps are origin-isolated.** `SERVED_APP_CSP` puts every page
//     under /p/ into a CSP sandbox with no `allow-same-origin`, so app code runs
//     in an opaque origin: it cannot read the owner's admin session cookie, this
//     origin's storage, or call the site's authenticated APIs as the owner. That
//     is what makes it safe to run code on the same domain that takes payments.
//     The cost is that sandboxed pages have no cookies and no localStorage — see
//     docs/writing-code-on-the-site.md.

import { getDatabase } from '@netlify/database'
import { randomBytes } from 'node:crypto'

// ---- limits ------------------------------------------------------------------
//
// Generous enough for real single-page tools, small enough that a runaway paste
// or a scripted client cannot fill the database. Enforced server-side; the
// editor mirrors them only to show a friendlier message.

export const MAX_FILES_PER_APP = 24
export const MAX_FILE_BYTES = 512 * 1024
export const MAX_APP_BYTES = 2 * 1024 * 1024
export const MAX_APPS = 200
export const MAX_TITLE_LENGTH = 80

/** Extensions the workspace will store and serve, with their content types. */
const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json',
}

export const ALLOWED_EXTENSIONS = Object.keys(CONTENT_TYPES)

/**
 * Content-Security-Policy for everything served out of /p/.
 *
 * `sandbox` without `allow-same-origin` is the load-bearing part: the document
 * gets an opaque origin, so app code cannot touch this origin's cookies or
 * storage no matter what it contains. Because that isolation holds, the rest of
 * the policy can afford to be permissive — CDN libraries (Tailwind, React,
 * charting) are most of what makes a browser-only workspace usable, and the
 * worst an unexpected script can do is misbehave inside its own sandbox.
 *
 * `allow-top-navigation` is deliberately absent: an app cannot navigate the
 * window away from the site. `frame-ancestors 'self'` lets the editor preview it
 * in an iframe while refusing to be embedded anywhere else.
 */
export const SERVED_APP_CSP = [
  'sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox',
  "default-src 'self' https: data: blob:",
  "script-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' https: data: 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' https: data:",
  "connect-src 'self' https: data: blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
].join('; ')

// ---- types -------------------------------------------------------------------

export interface CodeAppSummary {
  slug: string
  title: string
  published: boolean
  createdAt: string
  updatedAt: string
  fileCount: number
}

export interface CodeFile {
  path: string
  content: string
}

export interface CodeApp extends CodeAppSummary {
  files: CodeFile[]
}

/** Thrown for anything the caller can fix; carries the status to return. */
export class WorkspaceError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// ---- validation --------------------------------------------------------------

/**
 * Turn a human title into a URL slug, or validate one the caller supplied.
 *
 * Restricted to `[a-z0-9-]` so a slug can never introduce a path segment, a
 * query string, or a character that changes how /p/<slug> is parsed.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/

export function assertSlug(slug: string): string {
  if (!SLUG_RE.test(slug)) {
    throw new WorkspaceError('Invalid app id. Use lowercase letters, numbers and hyphens.')
  }
  return slug
}

/**
 * Validate a file path.
 *
 * Rejects absolute paths, `..` traversal, dotfiles, backslashes, and any
 * extension not in the allowlist. One shallow directory level is permitted so an
 * app can keep `lib/` or `assets/` tidy, and nothing deeper — there is no reason
 * for a single-page tool to need it, and every level is more surface to check.
 */
export function assertFilePath(input: string): string {
  const path = String(input || '').trim()
  if (!path) throw new WorkspaceError('A file needs a name.')
  if (path.length > 120) throw new WorkspaceError('File name is too long.')
  if (path.startsWith('/') || path.includes('\\') || path.includes('..')) {
    throw new WorkspaceError(`Invalid file name "${path}".`)
  }
  const segments = path.split('/')
  if (segments.length > 2) throw new WorkspaceError('Files can be at most one folder deep.')
  for (const segment of segments) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)) {
      throw new WorkspaceError(`Invalid file name "${path}".`)
    }
  }
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (segments[segments.length - 1].indexOf('.') === -1 || !CONTENT_TYPES[ext]) {
    throw new WorkspaceError(
      `"${path}" is not a supported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`,
    )
  }
  return path
}

export function assertTitle(input: string): string {
  const title = String(input || '').trim().replace(/\s+/g, ' ')
  if (!title) throw new WorkspaceError('Give the app a name.')
  if (title.length > MAX_TITLE_LENGTH) {
    throw new WorkspaceError(`Name must be ${MAX_TITLE_LENGTH} characters or fewer.`)
  }
  return title
}

/** Content type for a stored path, used when serving it from /p/. */
export function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'text/plain; charset=utf-8'
}

/**
 * Give an HTML document a base URL of its own app directory, so that a sibling
 * file referenced relatively (`<link href="style.css">`) resolves whether or not
 * the request URL carried a trailing slash.
 *
 * The usual fix is to redirect /p/<slug> to /p/<slug>/, but Netlify normalises
 * trailing slashes itself, and a redirect that fights that normalisation is a
 * loop waiting to happen. Injecting the base tag makes both URL forms work with
 * no redirect at all. A document that declares its own <base> is left alone.
 */
export function withBaseHref(html: string, slug: string): string {
  if (/<base\s/i.test(html)) return html
  const tag = `<base href="/p/${slug}/">`
  const head = html.match(/<head[^>]*>/i)
  if (head?.index !== undefined) {
    const at = head.index + head[0].length
    return html.slice(0, at) + tag + html.slice(at)
  }
  const htmlTag = html.match(/<html[^>]*>/i)
  if (htmlTag?.index !== undefined) {
    const at = htmlTag.index + htmlTag[0].length
    return html.slice(0, at) + tag + html.slice(at)
  }
  return tag + html
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

// ---- starter template -------------------------------------------------------
//
// A new app is never empty. An empty editor on a phone is a dead end — there is
// no obvious first keystroke and no way to tell whether the plumbing works. This
// template runs, proves the round trip end to end, and shows the two things that
// are easy to get wrong from a phone: linking a sibling file, and where the app's
// public URL is.

function starterFiles(title: string, slug: string): CodeFile[] {
  const safeTitle = title.replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string,
  )
  return [
    {
      path: 'index.html',
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>Live at <code>/p/${slug}</code> — edit this from any browser.</p>
    <button id="go">Tap me</button>
    <p id="out"></p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
    },
    {
      path: 'style.css',
      content: `:root { color-scheme: dark; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #080000;
  color: #f5f0e8;
  font: 16px/1.6 system-ui, -apple-system, Segoe UI, sans-serif;
}

main { padding: 2rem 1.25rem; max-width: 34rem; text-align: center; }

h1 { font-size: clamp(1.6rem, 6vw, 2.4rem); margin: 0 0 .5rem; }

code { background: #ffffff14; padding: .15em .4em; border-radius: .3em; }

button {
  margin-top: 1rem;
  padding: .8rem 1.4rem;
  font: inherit;
  font-weight: 600;
  color: #080000;
  background: #f5b642;
  border: 0;
  border-radius: .6rem;
  cursor: pointer;
}
`,
    },
    {
      path: 'app.js',
      content: `const out = document.getElementById('out');
let taps = 0;

document.getElementById('go').addEventListener('click', () => {
  taps += 1;
  out.textContent = taps === 1 ? 'It works.' : \`It works. (\${taps} taps)\`;
});
`,
    },
  ]
}

// ---- reads -------------------------------------------------------------------

function toSummary(row: any): CodeAppSummary {
  return {
    slug: row.slug,
    title: row.title,
    published: row.published === true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    fileCount: Number(row.file_count ?? 0),
  }
}

export async function listApps(): Promise<CodeAppSummary[]> {
  const db = getDatabase()
  const rows = await db.sql`
    SELECT a.slug, a.title, a.published, a.created_at, a.updated_at,
           COUNT(f.id) AS file_count
    FROM code_apps a
    LEFT JOIN code_files f ON f.app_id = a.id
    GROUP BY a.id
    ORDER BY a.updated_at DESC
  `
  return (rows as any[]).map(toSummary)
}

export async function getApp(slug: string): Promise<CodeApp | null> {
  assertSlug(slug)
  const db = getDatabase()
  const appRows = await db.sql`
    SELECT id, slug, title, published, created_at, updated_at
    FROM code_apps WHERE slug = ${slug}
  `
  const app = (appRows as any[])[0]
  if (!app) return null

  const fileRows = await db.sql`
    SELECT path, content FROM code_files WHERE app_id = ${app.id} ORDER BY path
  `
  const files = (fileRows as any[]).map((r) => ({ path: r.path, content: r.content ?? '' }))
  return { ...toSummary({ ...app, file_count: files.length }), files }
}

/**
 * Read one file for serving. Kept separate from getApp so a request for
 * /p/<slug>/app.js does not pull the whole app's source into memory.
 */
export async function getFile(
  slug: string,
  path: string,
): Promise<{ content: string; published: boolean; updatedAt: string } | null> {
  assertSlug(slug)
  const db = getDatabase()
  const rows = await db.sql`
    SELECT f.content, f.updated_at, a.published
    FROM code_files f
    JOIN code_apps a ON a.id = f.app_id
    WHERE a.slug = ${slug} AND f.path = ${path}
  `
  const row = (rows as any[])[0]
  if (!row) return null
  return {
    content: row.content ?? '',
    published: row.published === true,
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

/** Does the app exist at all? Used to tell "no such app" from "no such file". */
export async function appExists(slug: string): Promise<{ published: boolean } | null> {
  assertSlug(slug)
  const db = getDatabase()
  const rows = await db.sql`SELECT published FROM code_apps WHERE slug = ${slug}`
  const row = (rows as any[])[0]
  return row ? { published: row.published === true } : null
}

// ---- writes ------------------------------------------------------------------

async function claimSlug(desired: string): Promise<string> {
  const db = getDatabase()
  const base = desired || 'app'
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`
    const rows = await db.sql`SELECT 1 FROM code_apps WHERE slug = ${candidate}`
    if ((rows as any[]).length === 0) return candidate
  }
  return `${base}-${randomBytes(4).toString('hex')}`
}

export async function createApp(rawTitle: string, rawSlug?: string): Promise<CodeApp> {
  const title = assertTitle(rawTitle)
  const db = getDatabase()

  const countRows = await db.sql`SELECT COUNT(*) AS n FROM code_apps`
  if (Number((countRows as any[])[0]?.n ?? 0) >= MAX_APPS) {
    throw new WorkspaceError(`The workspace holds at most ${MAX_APPS} apps. Delete one first.`)
  }

  const desired = rawSlug ? assertSlug(slugify(rawSlug)) : slugify(title)
  const slug = await claimSlug(desired || 'app')

  const inserted = await db.sql`
    INSERT INTO code_apps (slug, title) VALUES (${slug}, ${title})
    RETURNING id, slug, title, published, created_at, updated_at
  `
  const app = (inserted as any[])[0]

  for (const file of starterFiles(title, slug)) {
    await db.sql`
      INSERT INTO code_files (app_id, path, content)
      VALUES (${app.id}, ${file.path}, ${file.content})
    `
  }

  const created = await getApp(slug)
  if (!created) throw new WorkspaceError('Could not create the app.', 500)
  return created
}

/**
 * Write a set of files. Each entry is upserted, so the editor can send only what
 * changed; files are removed with `deleteFile`, never by omission — a dropped
 * request must not be able to delete source.
 */
export async function saveFiles(slug: string, files: CodeFile[], title?: string): Promise<CodeApp> {
  assertSlug(slug)
  if (!Array.isArray(files) || files.length === 0) {
    throw new WorkspaceError('Nothing to save.')
  }

  const db = getDatabase()
  const appRows = await db.sql`SELECT id FROM code_apps WHERE slug = ${slug}`
  const app = (appRows as any[])[0]
  if (!app) throw new WorkspaceError('No such app.', 404)

  // Validate everything before writing anything, so a bad file in the batch
  // cannot leave the app half-saved.
  const clean = files.map((f) => ({
    path: assertFilePath(f.path),
    content: typeof f.content === 'string' ? f.content : '',
  }))
  for (const file of clean) {
    if (byteLength(file.content) > MAX_FILE_BYTES) {
      throw new WorkspaceError(`${file.path} is larger than ${Math.round(MAX_FILE_BYTES / 1024)} KB.`)
    }
  }

  const existingRows = await db.sql`
    SELECT path, OCTET_LENGTH(content) AS bytes FROM code_files WHERE app_id = ${app.id}
  `
  const existing = new Map(
    (existingRows as any[]).map((r) => [r.path as string, Number(r.bytes ?? 0)]),
  )
  const paths = new Set(existing.keys())
  for (const file of clean) paths.add(file.path)
  if (paths.size > MAX_FILES_PER_APP) {
    throw new WorkspaceError(`An app can hold at most ${MAX_FILES_PER_APP} files.`)
  }

  let total = 0
  for (const [path, bytes] of existing) {
    const replacement = clean.find((f) => f.path === path)
    total += replacement ? byteLength(replacement.content) : bytes
  }
  for (const file of clean) if (!existing.has(file.path)) total += byteLength(file.content)
  if (total > MAX_APP_BYTES) {
    throw new WorkspaceError(`An app can hold at most ${Math.round(MAX_APP_BYTES / 1024)} KB in total.`)
  }

  for (const file of clean) {
    await db.sql`
      INSERT INTO code_files (app_id, path, content, updated_at)
      VALUES (${app.id}, ${file.path}, ${file.content}, now())
      ON CONFLICT (app_id, path)
      DO UPDATE SET content = EXCLUDED.content, updated_at = now()
    `
  }

  if (title !== undefined) {
    await db.sql`UPDATE code_apps SET title = ${assertTitle(title)}, updated_at = now() WHERE id = ${app.id}`
  } else {
    await db.sql`UPDATE code_apps SET updated_at = now() WHERE id = ${app.id}`
  }

  const saved = await getApp(slug)
  if (!saved) throw new WorkspaceError('No such app.', 404)
  return saved
}

export async function deleteFile(slug: string, rawPath: string): Promise<CodeApp> {
  assertSlug(slug)
  const path = assertFilePath(rawPath)
  if (path === 'index.html') {
    throw new WorkspaceError('index.html is what /p/ serves — it cannot be deleted.')
  }
  const db = getDatabase()
  await db.sql`
    DELETE FROM code_files
    WHERE path = ${path} AND app_id = (SELECT id FROM code_apps WHERE slug = ${slug})
  `
  await db.sql`UPDATE code_apps SET updated_at = now() WHERE slug = ${slug}`
  const app = await getApp(slug)
  if (!app) throw new WorkspaceError('No such app.', 404)
  return app
}

export async function setPublished(slug: string, published: boolean): Promise<CodeApp> {
  assertSlug(slug)
  const db = getDatabase()
  await db.sql`
    UPDATE code_apps SET published = ${published}, updated_at = now() WHERE slug = ${slug}
  `
  const app = await getApp(slug)
  if (!app) throw new WorkspaceError('No such app.', 404)
  return app
}

export async function renameApp(slug: string, rawTitle: string): Promise<CodeApp> {
  assertSlug(slug)
  const title = assertTitle(rawTitle)
  const db = getDatabase()
  await db.sql`UPDATE code_apps SET title = ${title}, updated_at = now() WHERE slug = ${slug}`
  const app = await getApp(slug)
  if (!app) throw new WorkspaceError('No such app.', 404)
  return app
}

export async function deleteApp(slug: string): Promise<void> {
  assertSlug(slug)
  const db = getDatabase()
  // code_files rows go with it via ON DELETE CASCADE.
  await db.sql`DELETE FROM code_apps WHERE slug = ${slug}`
}
