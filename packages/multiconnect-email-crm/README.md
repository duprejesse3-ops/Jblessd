# MultiConnect: Email/CRM

Let your agent handle email and contacts — safely.

Runs entirely on your own machine: a local dashboard for connecting SMTP,
an approval queue so nothing sends without you clicking approve, a simple
built-in contact list, and an inbound-email webhook so a provider like
SendGrid or Mailgun can hand parsed messages straight to your agent.

## Install

Windows: `.\install.ps1`
macOS / Linux: `./install.sh`

Either way, this starts the connector in the foreground and prints a
dashboard URL, a local auth token, and your inbound webhook URL.

## Setting up SMTP

Most providers give you an app-specific password for this:

- **Gmail** — enable 2-Step Verification, then create an [App
  Password](https://myaccount.google.com/apppasswords). Host
  `smtp.gmail.com`, port `465`, secure on.
- **Outlook/Microsoft 365** — host `smtp.office365.com`, port `587`,
  secure off (STARTTLS is negotiated separately; if your account requires
  it, use an app password there too).
- **Any other provider** — check their SMTP settings page for host/port.

Enter these in the dashboard's SMTP connection section.

## The approval queue

This is the whole safety model: your agent can always create a draft (via
`POST /api/drafts`), but a draft only ever actually sends after a human
clicks **Approve & send** in the dashboard — and only if safe mode is set
to read/write. A per-hour send limit (default 20) caps how many can go out
even once approved, so a runaway agent can't blast a list.

## Inbound email

Point your provider's inbound-parse webhook at the URL the dashboard shows
you (it includes a secret token in the query string — no separate auth
header needed, since the provider calls this route directly). Every
inbound message is logged in the activity feed so your agent has something
to react to.

## Contacts

A simple built-in list (`GET /api/contacts`, `POST /api/contacts`) for when
you don't have a real CRM connected — not a replacement for one, just
somewhere the agent can read and log people.

## Development

```
npm test
```

Zero dependencies — plain Node.js (18+), no build step. SMTP is
implemented directly over `node:net`/`node:tls` rather than pulling in
nodemailer.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
