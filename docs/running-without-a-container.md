# Running the site without a container

**Short version: you already have this.** The deployed Netlify site *is* the
self-hosting answer. The code lives on the site, Netlify runs it, and using it
means opening a URL on whatever device is in front of you. Nothing needs to be
installed, and `container/` is not part of that path.

## What to open

| Surface | URL | What it is |
| --- | --- | --- |
| Storefront | `https://multinicheai.com/` | The catalog, concierge, checkout |
| Agent studio | `https://multinicheai.com/agent` | Brief a Claude agent, pay per run |
| Operator console | `https://multinicheai.com/admin` | Your private workstation, password-gated |
| Code workspace | `https://multinicheai.com/code` | Write code in the browser; the site serves it at `/p/<name>` |

Those work on a phone, a tablet, a laptop, a borrowed computer — anything with a
browser and no setup at all.

## Making it open like an app

The site is a PWA, so it can be installed as a real app window with its own icon
and no address bar. Same code either way; installing only changes how it launches.

- **Chrome / Edge, desktop or Android** — an **Install app** button appears in the
  header once the browser confirms it is installable. There is also an install
  icon in the address bar.
- **iPhone / iPad (Safari)** — Share → **Add to Home Screen**.
- **macOS Safari** — File → **Add to Dock**.
- **Operator console** — open `/admin` first, then add *that* to your home screen
  or dock. It installs as its own window, separate from the storefront.
- **Code workspace** — same: open `/code`, then add that. Neither it nor the
  console is listed in the public site manifest, on purpose.

Once installed, the storefront and the agent studio both open from cache, so a
weak signal shows the app rather than a browser error. The console and the code
workspace are deliberately never cached: they show live data and live source, and
a stale copy would be worse than no copy.

## Writing code without a computer

`/code` is the part that used to require a machine. You write an app's source in a
browser — including on a phone — the site stores it, and it is served back at
`https://multinicheai.com/p/<name>/` as soon as it saves. No build step, no deploy, no
toolchain, no container.

Drafts are visible only to you until you publish them. Apps run sandboxed, so what
you write cannot reach the site's own session or data.

Full notes: [`writing-code-on-the-site.md`](./writing-code-on-the-site.md).

## Where the code actually runs

Every piece runs on Netlify. There is no second machine in the picture.

| Part | Lives in | Runs as |
| --- | --- | --- |
| Pages | `index.html`, `agent.html`, `admin.html`, `code.html` | Static files on Netlify's CDN |
| API | `netlify/functions/*.mts` | Netlify Functions, reached at `/api/*` |
| SSR pages, CSP, tag gateway | `netlify/edge-functions/*.ts` | Netlify Edge Functions |
| Data | `netlify/database/migrations/` | Netlify Database (managed Postgres) |
| Files, counters, rate limits | via `@netlify/blobs` | Netlify Blobs |
| Scheduled jobs | `netlify/functions/*-agent.mts`, `subscriber-digest.mts` | Netlify scheduled functions |
| Workspace apps | written in the browser, stored in Netlify Database | `netlify/functions/code-serve.mts`, served at `/p/*` |

Changing the *site* means pushing a commit. Netlify builds and deploys it, and the
next time you open the app on any device you have the new version — the service
worker refetches the shell on each launch, so you are not stuck on an old copy.

Changing an app you wrote in `/code` needs none of that: it is served straight from
the database, so a save is live on the next load.

## So what is `container/` for?

Running this same code **off** Netlify — on your own server, a customer's machine,
or an air-gapped box — with Docker or Podman supplying Postgres and a Node
runtime. It exists for the case where Netlify is not available or not wanted.

It is not a prerequisite for anything above, and it is not how you use your own
site. If Docker or Podman would not cooperate, nothing is lost: leave it alone.
The live site is not waiting on it.

And if you want to run it off Netlify but Docker is the part that never worked,
you can skip the container runtime entirely: Node plus a Postgres is enough. The
step-by-step version, verified as far as a machine without Postgres allows, is
[`self-hosting-checklist.md`](./self-hosting-checklist.md).

The one thing a container used to give you that the live site could not was a place
to write and try code without deploying it. That is now `/code`, on the site, from
any device — see [`writing-code-on-the-site.md`](./writing-code-on-the-site.md).

For changes to the storefront's own source — the catalog, the checkout, the
functions — use Netlify Deploy Previews: open a pull request and Netlify builds it
at its own URL, with functions, database and all, which you then open on your phone
exactly like production. Same idea, no container runtime involved.
