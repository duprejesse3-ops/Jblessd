# MultiWitness

A tamper-evident, hash-chained action log for your AI agents.

Every event any tool logs here is chained to the one before it with a
SHA-256 hash — editing, deleting, or reordering a past entry breaks every
hash after it. Point your other MultiConnect tools (or anything else) at
it, and you get a provable answer to "what did my agent actually do,"
checkable by anyone with the log file — no server, no trust required.

## Install

Windows: `.\install.ps1`
macOS / Linux: `./install.sh`

This starts MultiWitness in the foreground and prints a dashboard URL,
a dashboard token, and a separate ingest token.

## Two tokens, on purpose

- **Dashboard token** — for you. Reads the history, runs verification.
- **Ingest token** — for other tools. Can only append a new event; there is
  no update or delete route for it to misuse even if it leaks.

Give the ingest token to any of your other MultiConnect connectors (or
your own scripts, cron jobs, anything) so their actions get logged here
too.

## Logging an event

```bash
curl -X POST http://localhost:8429/api/events \
  -H "Authorization: Bearer YOUR_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"multiconnect-shopify","action":"order.confirmation_drafted","detail":"Order #4821"}'
```

## Verifying the chain

From the dashboard, hit **Verify chain now**. Or, without the server even
running — this is the point of the whole product — from the command line:

```bash
node bin/witness.mjs verify
# or, from anywhere:
multiwitness verify /path/to/witness.log.jsonl
```

It reads the raw log file, recomputes every hash, and tells you plainly
whether the chain is intact or exactly where it broke.

## Development

```bash
npm test
```

Zero dependencies — plain Node.js (18+), no build step, no database. The
log is a plain JSON Lines file you can back up, move, or hand to someone
else to verify independently.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
