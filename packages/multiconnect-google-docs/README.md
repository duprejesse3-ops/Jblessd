# multivault-docs-bridge

Exports Google Docs to local markdown files, one-way, on a schedule — so
tools that only read local files (like [MultiVault], sold separately) can
see content that otherwise only exists in a Google Doc.

[MultiVault]: https://jblessd.com/product/AI-CN-008

## Why this exists

Drive for Desktop syncs *real files* to your machine just fine. It does
**not** turn a native Google Doc into a readable local file — a synced
`.gdoc` is a tiny pointer file containing a link back to Google's servers,
not the document's actual content. If your context lives in Google Docs (not
uploaded files), Drive sync alone doesn't close that gap. This tool does:
it asks Google to convert each Doc to plain markdown server-side (the same
conversion "File → Download → Markdown" does by hand) and writes the result
to a local folder, automatically, on whatever schedule you set.

## What this actually does

- Reads Google Docs you authorize (read-only Drive scope — this tool cannot
  create, modify, or delete anything in your Drive, by construction, not
  just by promise: see `lib/auth.mjs`'s `SCOPE`).
- Exports each one as a `.md` file in a destination folder you choose.
- Only re-exports a Doc when it's actually changed since the last run
  (tracked by Google's own `modifiedTime` for that file) — an unchanged
  folder costs one list call, not N re-exports.
- Cleans up after itself: a Doc renamed in Drive gets its old local filename
  removed, not duplicated; a Doc deleted (or moved out of the folder you
  scoped to) has its local copy removed too.

## What this explicitly does NOT do

- No Sheets, Slides, or any file type besides native Google Docs.
- No write-back to Drive, ever. One-way: Drive → local files.
- No AI, no content interpretation — Google's own export does the
  Doc-to-markdown conversion; this tool just requests it and writes the
  result to disk.
- No bundling with MultiVault's own dependency-free core — this is a
  separate, optional tool with its own (minimal) setup, precisely so
  MultiVault itself never needs an OAuth dependency just because *you*
  happen to use Google Docs.

## One-time setup

This needs a Google Cloud OAuth client — unavoidable for any real Drive
integration, not a design choice made here. Ten minutes, done once:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/),
   create a project (or use an existing one).
2. **APIs & Services → Library** → search "Google Drive API" → Enable.
3. **APIs & Services → OAuth consent screen** → set it up as "External" if
   you don't have a Google Workspace, add your own email as a test user.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type: **Desktop app** → name it anything → Create. Copy
   the **Client ID** and **Client Secret** it shows you.
5. Run:
   ```
   node bin/docs-bridge.mjs auth --client-id <id> --client-secret <secret>
   ```
   This prints a URL. Open it, sign in, approve. You're done — the refresh
   token is saved locally (see "Security model" below).

## Quick start

```
node bin/docs-bridge.mjs auth --client-id <id> --client-secret <secret>
node bin/docs-bridge.mjs sync --dest ~/Documents/ClientVault
```

Point MultiVault's watched folder at `~/Documents/ClientVault` (or a
subfolder of it) and its own watcher picks up the exported `.md` files from
there — this tool's job ends at "write accurate files locally."

Run it again anytime — `--dest` and any `--folder-id` you set are
remembered, so a scheduled run doesn't need every flag repeated:

```
node bin/docs-bridge.mjs sync
```

## Scoping to one Drive folder (recommended)

By default this exports every Google Doc your account can see. For most
people that's more than intended — scope it to one folder instead:

```
node bin/docs-bridge.mjs sync --dest ~/Documents/ClientVault --folder-id <drive-folder-id>
```

The folder ID is the long string in that folder's Drive URL:
`https://drive.google.com/drive/folders/`**`1a2B3cD4eFgH...`**

## Keeping it fresh

Three scheduling adapters are included in `adapters/` — same pattern as
MultiVault's own:

- `adapters/cron.sh` — any Linux/macOS machine with cron
- `adapters/launchd.plist` — macOS, preferred over cron there (survives sleep/wake)
- `adapters/windows-task.ps1` — Windows Task Scheduler

Each just runs `docs-bridge sync` on a timer — see the header comment in
each file for install steps. You must run `docs-bridge auth` interactively
once, by hand, before setting up scheduling — the saved refresh token is
what lets scheduled runs proceed unattended after that.

## Security model, plainly stated

- **Read-only, by construction.** The OAuth scope requested
  (`drive.readonly`) cannot create, modify, or delete anything in Drive —
  this isn't a policy this tool follows, it's what Google's API will and
  won't allow with that scope, enforced on Google's side.
- **The refresh token is a real, long-lived credential.** It's saved to
  `~/.multivault-docs-bridge/config.json` (or `--config` if you chose a
  different path) in plain JSON — not encrypted, same trade MultiVault's
  own `vault.meta.json` makes: encrypting it would mean typing a passphrase
  before every unattended scheduled run, defeating the point. On Unix-like
  systems (Linux, macOS) the file is written with `0600` permissions (owner
  read/write only) automatically. Windows doesn't have a direct equivalent
  to Unix permission bits — keep the config folder itself access-controlled
  via normal NTFS permissions.
- **Revoke anytime** at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  — this immediately invalidates the saved refresh token; the next sync
  attempt fails clearly rather than silently.
- **No network calls except to Google.** Nothing here talks to [SELLER]'s
  servers, to MultiVault, or to any third party — only Google's own OAuth
  and Drive endpoints. Read the source; it's plain, dependency-free
  JavaScript specifically so that's easy to verify yourself.
- **Zero npm dependencies.** OAuth token exchange and the Drive API calls
  are both plain `fetch` against documented REST endpoints — no
  `googleapis` SDK (a genuinely large dependency for what two endpoints
  actually need).

## Commands

```
docs-bridge auth   --client-id <id> --client-secret <secret>   [--config <path>]
docs-bridge sync   [--dest <path>] [--folder-id <id>] [--config <path>]
docs-bridge status [--config <path>]
```

`docs-bridge status` never prints the refresh token itself — only whether
one is present — so you can safely check configuration state without
exposing the credential.

## Testing

```
npm test
```

Runs all three suites (20 tests). Only Google's own HTTP endpoints are
mocked — the one thing genuinely untestable without live credentials.
Everything downstream of that (file writes, incremental skip/rename/delete
logic, state persistence, the local OAuth callback server) runs for real
against a real temp directory and, for the callback server test, a real
running HTTP server receiving a real request. One of the bugs this caught
during development: an early version of the file-permission logic compared
`os.platform` (a function) directly to `'win32'`, which is always true
regardless of actual OS — the restrictive-permissions code path was never
actually being applied correctly. Fixed and covered by a test that checks
the actual mode bits on the saved file, not just that the function runs
without throwing.
