# Writing code on the site itself

The site hosts its own development environment. You write code in a browser at
**[/code](https://multinicheai.com/code)** and the site serves it back at
`/p/<name>` — instantly, with no build, no deploy, no laptop and no container.

A phone is a sufficient computer for the whole cycle.

## The loop

1. Open `https://multinicheai.com/code` on anything with a browser.
2. Enter the owner password (the same `ADMIN_PASSWORD` that opens `/admin`).
3. Tap **+ new**. You get a working three-file app — `index.html`, `style.css`,
   `app.js` — that already renders.
4. Edit. It saves on its own about a second after you stop typing; `save` and
   Ctrl/Cmd+S force it.
5. The preview beside the editor *is* the live URL, not a simulation. On a phone,
   **preview** switches to it.
6. **publish** makes the link public. **link** copies it. **open ↗** opens it in
   its own tab.

That is the whole thing. Nothing is queued, staged or built — the URL serves what
is in the editor as soon as it saves.

## What you get

| | |
| --- | --- |
| Editor | `https://multinicheai.com/code` — owner-only |
| Your app | `https://multinicheai.com/p/<name>/` |
| Storage | Netlify Database, so an app started on a phone opens on a laptop |
| Files per app | up to 24, one folder deep, 512 KB each |
| File types | `html`, `css`, `js`, `mjs`, `json`, `svg`, `txt`, `md`, `csv`, `xml`, `webmanifest` |

`index.html` is the page. Other files sit beside it, so `<link href="style.css">`
and `<script src="app.js">` work as written — the server injects a `<base>` tag so
they resolve with or without a trailing slash on the URL.

**Drafts are private.** A new app is a draft: only a browser holding your owner
session can open its URL, so you can test on your phone before anyone else can
see it. To everyone else it is a 404 — which reveals nothing about what you are
working on. **publish** is what makes it public.

## What runs, and what does not

Apps are served **sandboxed**. Each page gets an opaque origin, which is what
makes it safe to run hand-written code on the same domain that takes card
payments: app code cannot read your admin session cookie, cannot touch this
origin's stored data, and cannot call the site's own authenticated APIs as you.

Working inside an app:

- **Any JavaScript** — DOM, canvas, `fetch`, workers, `async`/`await`, modules.
- **CDN libraries over https** — React, Tailwind, Chart.js, htmx, and the rest
  load normally.
- **Public APIs** over https, subject to the other side's CORS rules.
- **Forms, downloads, pop-ups.**

Not available, as a direct consequence of the sandbox:

- **`localStorage`, `sessionStorage`, cookies, IndexedDB.** These throw in an
  opaque origin. Keep state in a JavaScript variable for the life of the page; for
  anything that must survive a reload, put the value in the URL (`?state=…`) or
  have the user copy it out.
- **Calling this site's `/api/*` endpoints as you.** The session cookie is not
  sent. This is the point, not a limitation to work around.
- **Navigating the top window away** from the site.

If an app genuinely needs to persist data or act as you, it belongs in
`netlify/functions/` in the repository, not in the workspace.

## Where it goes on your phone

`/code` installs as its own app window: Safari → Share → **Add to Home Screen**,
or Chrome → menu → **Install app**. It is deliberately not listed in the public
site manifest — the storefront's manifest is downloaded by every visitor, and this
route does not belong in it.

Published apps install the same way from their own `/p/<name>/` URL.

## Limits, and why they are there

| Limit | Value |
| --- | --- |
| Apps | 200 |
| Files per app | 24, at most one folder deep |
| File size | 512 KB |
| App total | 2 MB |

The workspace can create routes on a domain that sells things, so file names and
app names are checked against an allowlist rather than sanitised: lowercase
letters, digits and hyphens for names; no absolute paths, no `..`, no unknown
extensions. The size caps stop a runaway paste from filling the database.

Nothing under `/p/` is cached at any layer, and nothing under `/p/` or `/code` is
indexed — these are your tools and drafts, and they should not compete with the
catalog for the domain's ranking.

## Losing work

Unsaved keystrokes are mirrored into the browser's own storage as you type. If a
phone discards the tab, or the 8-hour session expires mid-edit, reopening the file
restores the draft and says so. A save clears it.

## How this replaces the container

`container/` exists to run this same code **off** Netlify. The one thing it gave
you that the live site could not was a place to try something without deploying
it — and that is now `/code`, on the site, from any device.

If Docker or Podman will not cooperate, nothing is blocked. See
[`running-without-a-container.md`](./running-without-a-container.md).

For changes to the storefront itself — the catalog, the checkout, the functions in
`netlify/functions/` — the workspace is the wrong tool: that is a commit, and
Netlify's Deploy Previews give you the same "try it on my phone first" loop with
the real site attached.

## Where it lives in the repository

| Piece | File |
| --- | --- |
| Editor | `code.html`, served at `/code` |
| Read/write API | `netlify/functions/code-workspace.mts` → `/api/code` |
| Serving apps | `netlify/functions/code-serve.mts` → `/p/*` |
| Validation, limits, sandbox policy | `netlify/lib/code-workspace.mts` |
| Tables | `netlify/database/migrations/20260812170000_create_code_workspace.sql` |

## If the workspace will not open

- **"locked until an owner password exists"** — `ADMIN_PASSWORD` is not set on the
  site. Netlify dashboard → Site configuration → Environment variables, add it,
  redeploy, reload.
- **"The workspace tables are not in this database yet"** — the migration has not
  run against this branch's database. Redeploy the branch.
- **Signed out mid-edit** — sessions last 8 hours. Your draft is kept locally;
  sign in again and it comes back.
