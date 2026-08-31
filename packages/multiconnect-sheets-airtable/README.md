# MultiConnect: Sheets/Airtable

Turn a spreadsheet into your agent's database.

Runs entirely on your own machine: a local dashboard for connecting Google
Sheets and/or Airtable, mapping fields with point-and-click, and reading or
appending rows — with a safe-mode switch that keeps writes off until you
turn them on.

## Install

Windows: `.\install.ps1`
macOS / Linux: `./install.sh`

Either way, this starts the connector in the foreground and prints a
dashboard URL and a local auth token.

## Setting up Google Sheets

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   service account and download its JSON key.
2. From that JSON, copy the `client_email` into the dashboard's "Service
   account email" field, and the `private_key` into "Service account
   private key" (paste it exactly as it appears, including the
   `-----BEGIN PRIVATE KEY-----` lines).
3. Open your Google Sheet, click **Share**, and share it with that service
   account's email address (Editor access if you want write access).
4. Copy the spreadsheet ID from the sheet's URL
   (`docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`) into the
   dashboard.

## Setting up Airtable

1. Create a [personal access token](https://airtable.com/create/tokens)
   scoped to the base you want to connect, with `data.records:read` (and
   `data.records:write` if you want write access).
2. Copy the token, your base ID (from the base's API docs page), and the
   table name into the dashboard.

## Safe mode

Every install starts **read-only**. Switch to **read/write** only when
you're ready to let the agent append rows or records. Every write call
checks this setting first and refuses outright if it's not enabled.

## Using it

- `GET /api/sheets/rows` / `GET /api/airtable/records` — read current data,
  mapped through your saved read mapping if you've set one.
- `POST /api/sheets/rows` / `POST /api/airtable/records` — append a new
  row/record, mapped through your saved write mapping.

All routes require your dashboard's auth token as a Bearer header.

## Development

```
npm test
```

Zero dependencies — plain Node.js (18+), no build step. Google's OAuth2
service-account flow is implemented directly with `node:crypto` rather than
pulling in the `googleapis` package.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
