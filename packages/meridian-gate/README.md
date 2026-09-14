# Meridian Gate

An outbound proxy that sits in front of every AI call on the same machine as
[Meridian Host](../meridian-host). Nothing leaves unless a named human said
it could. Every attempt — allowed or blocked — is written to an append-only,
hash-chained log you can hand to anyone and verify offline.

**Default is no.** A freshly installed Gate blocks 100% of outbound traffic
routed through it. You add hosts one at a time.

## Why this exists

Host runs your AI container on your own Pi or laptop instead of someone
else's cloud. That solves *where your data lives*. It does not by itself
stop the container's own code — or a library it pulls in, or a prompt
injection that convinces the model to "helpfully" call an unexpected
endpoint — from making an outbound call to somewhere you didn't choose.
Gate is that second lock: even code running as you, on your machine, can
only reach the network through this proxy, and this proxy only forwards to
hosts a human explicitly named.

## What it does

- Runs a plain HTTP/HTTPS forward proxy (`CONNECT` tunneling for HTTPS,
  which is what every AI API uses).
- Checks the destination host against a local allowlist before opening the
  tunnel. No matching rule → `403`, connection refused, nothing sent.
- Logs every decision — allow, block, and every rule change — to
  `gate.log.jsonl`, a SHA-256 hash-chained append log. Edit or delete a past
  line and every hash after it stops matching; `gate verify` catches that
  in one command.
- Never terminates or inspects TLS inside an *allowed* tunnel — Gate
  decides whether a call happens at all, not what's inside it. Your API
  keys and payloads stay opaque to Gate too.

## What it does not do

- It is not a content filter or DLP tool. It does not read request bodies,
  API keys, or response data for allowed hosts.
- It is not a firewall replacement — pair it with your OS firewall
  (Meridian Host ships one) rather than instead of one; Gate governs traffic
  routed *through* it, not every socket on the box.
- It does not call home. There is no telemetry, no update check, no network
  access at all other than the connections it is explicitly asked to make
  or refuse.

## Install

```bash
./install.sh
```

Or by hand: `node bin/gate.mjs` needs nothing beyond Node 18+ — zero
dependencies, nothing to `npm install`.

## Use

```bash
# Nothing is allowed yet. Add your first rule — you have to name yourself.
node bin/gate.mjs allow api.anthropic.com --by "jesse" --note "Claude API"

# Start the proxy (defaults to port 8899, see gate.config.json).
node bin/gate.mjs start
```

Point your AI tooling at it:

```bash
export HTTPS_PROXY=http://127.0.0.1:8899
```

Everything through that proxy that isn't on the allowlist gets refused at
the `CONNECT` step — before any request leaves the machine.

```bash
node bin/gate.mjs list      # what's currently allowed, and who allowed it
node bin/gate.mjs deny api.anthropic.com   # revoke — back to blocked by default
node bin/gate.mjs log       # recent decisions, newest first
node bin/gate.mjs verify    # check the witness log hasn't been tampered with
```

## Run it as a background service

See `adapters/systemd.service` (Linux/systemd). Run it on the same machine
as Host, under the same user, so Host's container traffic actually has to
pass through it.

## Files

```
lib/config.mjs   allowlist: load/save, add/remove/find a rule
lib/chain.mjs     the witness log — hash-chained append-only JSON Lines
lib/proxy.mjs     the actual HTTP/HTTPS CONNECT proxy
bin/gate.mjs      CLI: start, allow, deny, list, log, verify
adapters/         systemd unit for running Gate as a service
test/run.mjs      real tests, including an end-to-end CONNECT tunnel test
```

## Testing

```bash
npm test
```

Runs against real sockets — including a genuine `CONNECT` tunnel to a
throwaway local server — not mocked network calls.

## License

See `LICENSE.md`. One-time purchase, perpetual license, source included and
yours to modify. See the license for what you may and may not do with it.
