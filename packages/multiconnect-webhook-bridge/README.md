# MultiConnect: Zapier/Webhook Bridge

Connect your AI agent to thousands of apps — no code required.

Runs entirely on your own machine: a local dashboard for connecting your
Zapier or Make webhook, mapping fields with point-and-click (no manual JSON
editing), and watching every webhook call go by in a live test console. No
account, no third-party service, nothing phoning home.

## Install

**Windows**

```powershell
.\install.ps1
```

**macOS / Linux**

```bash
./install.sh
```

Either way, this starts the bridge in the foreground and prints:

```
  Dashboard:  http://localhost:8420
  Token:      <a random token, unique to your install>
  Inbound webhook URL (paste into Zapier/Make): http://localhost:8420/webhook
```

Open the dashboard URL, paste in the token, and you're in.

To have it start automatically at login instead of running it by hand each
time, see `adapters/windows-task.ps1` (Windows) or `adapters/systemd.service`
(Linux).

## Using it

### Outbound — your agent → Zapier/Make

1. In Zapier, create a Zap that starts with **"Webhooks by Zapier" → Catch
   Hook**, and copy the URL it gives you.
2. Paste that URL into the dashboard's **Connect** section and save.
3. In the **outbound mapping** section, map the fields your agent sends
   (e.g. `task.status`) to the field names your Zap expects (e.g.
   `event_status`).
4. Have your agent `POST` to `http://localhost:8420/trigger` with an
   `Authorization: Bearer <token>` header and a JSON body. The bridge maps it
   and forwards it to your Zap, retrying automatically on transient failures.

### Inbound — Zapier/Make → your agent

1. Paste `http://localhost:8420/webhook` into a Zap or Scenario as the
   action URL.
2. In the **inbound mapping** section, map the incoming fields to whatever
   shape your agent expects.
3. Every call Zapier/Make makes to that URL is mapped and logged — hook your
   agent up to read from wherever you want the mapped result to land (see
   `lib/inbound.mjs` if you want to change where inbound events go; by
   default they're available via the same `/api/log` the dashboard reads).

### Test console

The dashboard's test console shows the last 50 webhook calls — inbound and
outbound, success and failure — updating every few seconds. Use **Send test
outbound event** to fire a synthetic event through your real mapping and
webhook URL without needing your agent running yet.

## Development

```bash
npm test
```

Zero dependencies — plain Node.js (18+), no build step. `lib/` is organized
by concern (`config`, `mapping`, `inbound`, `outbound`, `log`, `server`) so
you can read or modify any one piece without touching the rest.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license. You
own your copy forever; you may not resell the software itself.
