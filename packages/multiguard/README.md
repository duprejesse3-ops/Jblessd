# MultiGuard

One dashboard and kill switch for every MultiConnect tool you run.

Each MultiConnect connector has its own safe-mode switch and its own log —
useful, but it means checking five separate dashboards to see what's
happening, or flipping five separate switches during an incident.
MultiGuard is the layer above them: register any connector by its
dashboard URL and token, see all of them in one place, and — the whole
point — hit one button to switch every one of them to read-only at once.

## Install

Windows: `.\install.ps1`
macOS / Linux: `./install.sh`

This starts MultiGuard in the foreground and prints a dashboard URL and a
token.

## Registering a connector

In the dashboard's **Register a connector** section, add:

- **Name** — whatever you want to call it
- **Base URL** — where that connector's own dashboard is running (e.g.
  `http://localhost:8421` for the Shopify connector)
- **Its dashboard token** — the token that connector printed when *it*
  started

MultiGuard works generically: it doesn't need to know which specific
MultiConnect product you're registering. It just needs a `GET /api/config`
that may report a `safeMode`, and a `GET /api/log` or `GET /api/entries`
that returns recent activity — the convention every MultiConnect tool
follows.

## Security note — read this before you use it

The tokens you paste into MultiGuard are real credentials for your other
connectors, stored in plain text in MultiGuard's own config file on this
machine. Anyone with access to that file, or to MultiGuard's own
dashboard, could reach into any connector you've registered. Treat
MultiGuard's dashboard token — and this machine — with the same care you'd
give the connectors themselves.

## The kill switch

Hitting **Engage kill switch** sends `{ "safeMode": "read-only" }` to
every registered connector's own config endpoint, in parallel. A connector
that's offline, or that doesn't have a safe-mode concept at all (like the
Webhook Bridge or MultiWitness), is reported honestly as such — this never
pretends something worked when it didn't.

## Development

```
npm test
```

Zero dependencies — plain Node.js (18+), no build step.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
