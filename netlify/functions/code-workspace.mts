// Netlify Function: /api/code
//
// The owner-only API behind the browser code workspace at /code. It is the write
// half of the site's self-hosting story: the editor in the browser holds no
// state of its own, so an app started on a phone is picked up on a laptop by
// loading it back from here.
//
//   GET  /api/code             — list every app in the workspace
//   GET  /api/code?slug=x      — one app with all of its source
//   POST /api/code             — { action, ... }, see ACTIONS below
//
// Every route requires the admin session cookie issued by /api/admin-auth; the
// same gate that protects /admin. There is no per-app authorisation because
// there is exactly one author.
//
// Reads and writes are separated by HTTP method rather than by action name so a
// GET can never mutate, which keeps the whole surface immune to being triggered
// by a stray link or an image tag.

import type { Config, Context } from '@netlify/functions'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import {
  ALLOWED_EXTENSIONS,
  MAX_APP_BYTES,
  MAX_FILES_PER_APP,
  MAX_FILE_BYTES,
  WorkspaceError,
  createApp,
  deleteApp,
  deleteFile,
  getApp,
  listApps,
  renameApp,
  saveFiles,
  setPublished,
} from '../lib/code-workspace.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Limits the editor renders in its own messages, so the two cannot disagree. */
const LIMITS = {
  maxFilesPerApp: MAX_FILES_PER_APP,
  maxFileBytes: MAX_FILE_BYTES,
  maxAppBytes: MAX_APP_BYTES,
  allowedExtensions: ALLOWED_EXTENSIONS,
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: NO_STORE })
}

export default async (req: Request, _context: Context) => {
  if (!isConfigured()) {
    return fail(
      'The workspace is locked because no owner password is set. Add an ADMIN_PASSWORD ' +
        'environment variable in your Netlify site settings, then redeploy.',
      503,
    )
  }

  if (!isAuthed(req, Date.now())) {
    return fail('Sign in at /code to use the workspace.', 401)
  }

  try {
    if (req.method === 'GET') {
      const slug = new URL(req.url).searchParams.get('slug')
      if (slug) {
        const app = await getApp(slug)
        if (!app) return fail('No such app.', 404)
        return Response.json({ app, limits: LIMITS }, { headers: NO_STORE })
      }
      return Response.json({ apps: await listApps(), limits: LIMITS }, { headers: NO_STORE })
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return fail('Invalid request body.')
    }

    const action = String(body?.action ?? '')
    const slug = body?.slug === undefined ? '' : String(body.slug)

    switch (action) {
      case 'create': {
        const app = await createApp(String(body?.title ?? ''), body?.slug ? String(body.slug) : undefined)
        return Response.json({ app, limits: LIMITS }, { headers: NO_STORE })
      }
      case 'save': {
        const files = Array.isArray(body?.files) ? body.files : []
        const app = await saveFiles(
          slug,
          files.map((f: any) => ({ path: String(f?.path ?? ''), content: String(f?.content ?? '') })),
          body?.title === undefined ? undefined : String(body.title),
        )
        return Response.json({ app, limits: LIMITS }, { headers: NO_STORE })
      }
      case 'newFile': {
        // A new file is a save of a single empty (or seeded) path.
        const app = await saveFiles(slug, [
          { path: String(body?.path ?? ''), content: String(body?.content ?? '') },
        ])
        return Response.json({ app, limits: LIMITS }, { headers: NO_STORE })
      }
      case 'deleteFile': {
        const app = await deleteFile(slug, String(body?.path ?? ''))
        return Response.json({ app, limits: LIMITS }, { headers: NO_STORE })
      }
      case 'publish':
        return Response.json(
          { app: await setPublished(slug, true), limits: LIMITS },
          { headers: NO_STORE },
        )
      case 'unpublish':
        return Response.json(
          { app: await setPublished(slug, false), limits: LIMITS },
          { headers: NO_STORE },
        )
      case 'rename':
        return Response.json(
          { app: await renameApp(slug, String(body?.title ?? '')), limits: LIMITS },
          { headers: NO_STORE },
        )
      case 'delete': {
        await deleteApp(slug)
        return Response.json({ ok: true, apps: await listApps() }, { headers: NO_STORE })
      }
      default:
        return fail(`Unknown action "${action}".`)
    }
  } catch (err) {
    if (err instanceof WorkspaceError) return fail(err.message, err.status)
    const message = (err as Error)?.message ?? 'Unknown error'
    console.error('code workspace:', message)
    // A missing table means the migration has not been applied to this branch's
    // database yet, which is a deploy state rather than a bug in the request.
    if (/code_apps|code_files/.test(message) && /does not exist|relation/i.test(message)) {
      return fail(
        'The workspace tables are not in this database yet. They are created by the ' +
          'migration in netlify/database/migrations — redeploy this branch and try again.',
        503,
      )
    }
    return fail('The workspace could not complete that. Try again.', 500)
  }
}

export const config: Config = {
  path: '/api/code',
}
