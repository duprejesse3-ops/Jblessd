# MultiConnect: Slack/Discord

Bring your AI agent into the channels you already use.

Runs entirely on your own machine: a local dashboard for wiring up named
"routes" (channel destinations), posting agent-triggered updates and alerts
to Slack and/or Discord, and receiving slash commands from both — with a
safe-mode switch that keeps posts off until you turn them on.

## Install

Windows: `.\install.ps1`
macOS / Linux: `./install.sh`

Either way, this starts the connector in the foreground and prints a
dashboard URL, a local auth token, and both webhook/interaction URLs.

## Setting up Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Under **Incoming Webhooks**, activate them and create one per channel
   you want to post to — each gives you a webhook URL to paste into a
   route in the dashboard.
3. Under **Basic Information**, copy the **Signing Secret** into the
   dashboard's Slack section.
4. If you want slash commands, add one under **Slash Commands** pointing
   at the "Slack request URL" the dashboard shows you.

## Setting up Discord

1. Create an application at the
   [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **General Information**, copy the **Public Key** into the
   dashboard's Discord section.
3. Under a server's **Integrations → Webhooks**, create one per channel —
   paste the URL into a route in the dashboard.
4. If you want slash commands, set **Interactions Endpoint URL** (under
   General Information) to the "Discord interactions" URL the dashboard
   shows you. Discord will send a verification ping the moment you save
   this — the connector answers it automatically as long as it's running.

## Routes

A route is a named destination. Give it a Slack webhook, a Discord
webhook, or both — posting to that route posts to whichever are set, so
one alert can reach both platforms at once.

## Safe mode

Every install starts **read-only**: incoming slash commands are received
and logged, but nothing posts. Switch to **read/write** to let posts
through `POST /api/post`. Every send checks this first and refuses
outright if it's not enabled.

## Development

```
npm test
```

Zero dependencies — plain Node.js (18+), no build step. Slack's HMAC
signing and Discord's Ed25519 signing are both implemented directly with
`node:crypto`.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
