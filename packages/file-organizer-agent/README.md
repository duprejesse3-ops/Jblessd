# file-organizer-agent

A file organizer you own outright. Point it at a messy folder, get files sorted
into categorized subfolders — no account, no API key, nothing phoning home. Runs
on your laptop, a scheduled task, cron, or launchd; whichever you prefer, and you
can change your mind later without rewriting anything.

```
$ node bin/organize.mjs ~/Downloads

Invoices & Receipts (3)
  invoice-march-2026.pdf
  receipt_amazon.pdf
  order-confirmation-4471.pdf

Screenshots (12)
  Screenshot 2026-08-20 at 09.14.png
  Screenshot 2026-08-21 at 14.02.png
  ...

Images (8)
  vacation-photo-1.jpg
  ...

47 file(s) planned — dry run, nothing moved. Pass --apply to move them.
```

## What makes it different

**Zero dependencies.** Not "few". None. The `dependencies` block in `package.json`
is empty and stays that way. It uses Node's built-in `node:fs`, `node:path`, and
`node:os`, and nothing else. There is no `npm install`, no lockfile to audit, no
transitive supply chain, no dependency that can be deprecated or taken over.

**No build step.** Plain `.mjs`. What is in the repository is what runs. No
TypeScript toolchain, no bundler, no transpile.

**No service, no account, no key — by default.** Classification is rule-based:
file extension plus filename keywords (`invoice`, `receipt`, `statement`,
`contract`, `screenshot`). It runs completely offline and works exactly the same
whether or not you've ever heard of an API key. The optional `--ai` flag exists
for the handful of files rules genuinely can't place — see "AI-assisted
classification" below — but the product's core promise does not depend on it.

**Plan first, move second.** Every run is `--dry-run` by default. Nothing on disk
changes until you explicitly pass `--apply`. This is not a suggestion you have to
remember — it's the actual default behavior of the CLI.

**Nothing platform-specific in the engine.** `lib/organize.mjs` does not know
about cron, launchd, or Windows. It exports plain functions — `planFolder()`,
`applyPlan()` — that take a folder path and return data. Everything host-shaped
lives in `adapters/`, and the adapters are examples you edit, not a framework you
adopt.

## Install

Unzip it, then run it directly with Node — no install step required:

```sh
unzip file-organizer-agent.zip
cd file-organizer-agent
node bin/organize.mjs --help
```

If you'd rather have a plain `organize` command available anywhere, use npm's
built-in linking (still installs nothing from the internet — it just points a
command at the folder you already have):

```sh
npm link
organize ~/Downloads
```

## Usage

```
organize [folder] [options]

  If [folder] is omitted, defaults to your Downloads folder.

Options
  --apply                 Actually move files (default: dry-run, plan only)
  --dest <folder>         Where organized files go (default: <folder>/Organized)
  --min-age <minutes>     Skip files newer than this, in case something's still
                           downloading (default: 2)
  --ai                    Use AI to classify files the rules can't place
                           (requires ANTHROPIC_API_KEY; sends filenames only,
                           never file contents)
  --format <text|json>    Output format (default: text)
  -h, --help               Show this message
  -v, --version            Show the engine version
```

Examples:

```sh
organize                          # plan for ~/Downloads, dry-run
organize ~/Desktop --apply        # actually sort the Desktop
organize ~/Downloads --ai --apply # use AI for anything the rules miss
organize . --dest ~/Sorted --apply
```

## Categories

Rule-based, out of the box: Documents, Spreadsheets, Presentations, Images,
Audio, Video, Archives, Installers, Code, Invoices & Receipts, Screenshots,
Statements, Contracts, and Other (the catch-all for anything unrecognized).

Filename keywords take priority over plain extension — `invoice-march.pdf` goes
to **Invoices & Receipts**, not the generic Documents bucket a bare `.pdf` would
get. Edit the `EXT_CATEGORY` and `KEYWORD_RULES` tables at the top of
`lib/organize.mjs` to add your own — it's a plain object and array, no build
step required to change them.

## Scheduling

Doing this by hand gets old fast. Three adapters are included in `adapters/` for
hands-off, hourly (or whatever cadence you choose) organizing:

- **`adapters/cron.sh`** — the universal fallback. Any Linux/Mac machine with
  Node and cron.
- **`adapters/launchd.plist`** — the native macOS scheduler. Preferred over cron
  there, since it handles the machine sleeping and waking correctly.
- **`adapters/windows-task.ps1`** — self-registers a Windows Task Scheduler
  entry with a single PowerShell run. No manual clicking through the Task
  Scheduler GUI.

Each has install instructions in a comment block at the top of the file.

## AI-assisted classification

Entirely optional. Set `ANTHROPIC_API_KEY` in your environment and pass `--ai`,
and any file the rule engine can't confidently place gets sent to Claude for a
one-word category guess — **only the filename**, never file contents. If the key
isn't set, `--ai` is a no-op and unrecognized files fall back to the `Other`
folder, exactly as if you'd never passed the flag.

## Tests

```sh
npm test
```

13 tests, no mocks — every test creates a real temporary directory with real
files and runs the engine against it. Run this after any edit to
`lib/organize.mjs`, and before you trust the tool with a folder you care about.

## License

See [LICENSE.md](./LICENSE.md). You own your copy outright; you may not resell
the software itself.
