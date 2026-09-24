# Bitcoin (Lightning) payments — BTCPay Server setup

This is the infrastructure half of Lightning checkout. The code half
(`netlify/lib/btcpay.mts`, `netlify/functions/create-btcpay-invoice.mts`,
`netlify/functions/btcpay-webhook.mts`) is already written and talks to
whatever BTCPay Server instance you configure — but that instance is real
infrastructure you run yourself, not something a code change can stand up.
This doc is what to actually do, in order.

**Honest scope check before you start:** this is the same "no cloud, we run
our own thing" philosophy as `multicontainer` and `MultiNicheVps`, applied to
payments. That means you're also taking on what BTCPay/Stripe/Coinbase
normally absorb for you: keeping a server patched, keeping a Lightning node
funded and online, and being the one who notices if something's wrong. If
that's not a tradeoff you want to own long-term, a hosted processor
(Coinbase Commerce, BitPay, OpenNode) is a legitimate, much lower-maintenance
alternative — see the note about that at the end.

## 1. A server

BTCPay Server needs its own machine — it should NOT run on the same box as
the multicontainer app or app.jblessd.com, since a Lightning node holds
real, spendable funds and you don't want it sharing a blast radius with
everything else. Minimum realistic spec: 2 vCPU, 4GB RAM, 60GB+ disk (a
pruned Bitcoin node still needs real space). This is the same
"MultiNicheVps" server plan already on your radar — it's a fine candidate to
host this on, kept logically separate (its own Docker stack) from the
storefront's container.

## 2. Install BTCPay Server

BTCPay's own install script is the standard, supported path — don't
hand-roll a Docker Compose file for this from scratch, the official one
handles the Bitcoin node + Lightning node + BTCPay app + reverse proxy + TLS
cert wiring correctly, which is exactly the kind of infrastructure glue
that's easy to get subtly wrong:

```bash
mkdir btcpay && cd btcpay
git clone https://github.com/btcpayserver/btcpayserver-docker
cd btcpayserver-docker
export BTCPAY_HOST="btcpay.multinicheai.com"   # a subdomain you control
export NBITCOIN_NETWORK="mainnet"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_LIGHTNING="lnd"                # LND — the most common choice
export BTCPAYGEN_REVERSEPROXY="nginx"
export LETSENCRYPT_EMAIL="you@multinicheai.com"
. ./btcpay-setup.sh -i
```

Point `btcpay.multinicheai.com`'s DNS at this server before running the
script — Let's Encrypt needs to reach it to issue a cert. Same DuckDNS +
Netlify DNS CNAME pattern you already used for app.jblessd.com works fine
here too, or a real A record if this VPS gets a static IP.

This takes a while (it's syncing a Bitcoin node from scratch, which is
hours-to-a-day depending on pruning settings). That's normal — it's not
stuck.

## 3. Lightning liquidity

An LND node with zero channels can't receive payments — Lightning needs
**inbound liquidity**, a channel with capacity someone has already funded
toward your side. Two practical paths:

- **Buy inbound liquidity** from a liquidity provider (e.g., through LND's
  own channel-opening tools, or a service like Voltage or Amboss) — costs a
  small amount, gets you receiving capacity immediately.
- **Open a channel yourself** by sending BTC on-chain to fund a channel to a
  well-connected node — free besides the on-chain fee, but you're providing
  your own outbound capacity, not necessarily inbound, and needs care to get
  the direction right.

This part is genuinely outside what I can walk through safely without more
specifics about your risk tolerance and how much volume you expect — get a
second opinion from BTCPay's own docs/community (they have a whole guide on
channel management) before moving real money through this.

## 4. Create a Store and register the webhook

In BTCPay's UI:

1. Create a Store (any name), note its **Store ID** (shown in Store
   Settings) → this is `BTCPAY_STORE_ID`.
2. Account → API Keys → create a key scoped to **"Create invoice"** and
   **"View invoices"** for that store only, nothing broader → this is
   `BTCPAY_API_KEY`.
3. Store Settings → Webhooks → Create Webhook:
   - URL: `https://multinicheai.com/api/btcpay-webhook`
   - Check **"An invoice has been settled"** (at minimum — others are
     harmless to also check, the handler ignores anything but
     `InvoiceSettled`)
   - Save, then copy the signing secret it shows you → this is
     `BTCPAY_WEBHOOK_SECRET`

## 5. Set the environment variables

In Netlify: Site settings → Environment variables:

```
BTCPAY_URL             https://btcpay.multinicheai.com
BTCPAY_API_KEY          <the API key from step 4.2>
BTCPAY_STORE_ID         <the store id from step 4.1>
BTCPAY_WEBHOOK_SECRET   <the signing secret from step 4.3>
```

Redeploy after setting these — `isConfigured()` in `netlify/lib/btcpay.mts`
checks all three at request time, so "Pay with Bitcoin" simply won't appear
as an option (rather than erroring) until they're all set.

## 6. Confirm the Lightning-only checkout field

`netlify/lib/btcpay.mts`'s `createInvoice()` sends
`checkout.paymentMethods: ["BTC-LightningNetwork"]` to restrict the invoice
to Lightning only, no on-chain option. **This field's exact name has moved
between BTCPay versions** — verify it against your instance's own API docs
before relying on it: your instance serves live Swagger docs at
`https://btcpay.multinicheai.com/swagger`, under the invoice-creation
endpoint. If it's changed, that's a one-line fix in `btcpay.mts`.

## 7. Test with a real, tiny payment

Before linking this from the live checkout page, create a test invoice by
calling `/api/create-btcpay-invoice` directly (or a small script), pay it
with a small amount of real sats from any Lightning wallet, and confirm:

- The invoice shows **Settled** in BTCPay's dashboard
- Netlify's function logs for `btcpay-webhook` show it received and
  processed the event
- The order-confirmation email actually arrives

Only wire the "Pay with Bitcoin" button into the live checkout page once
that full loop has been proven with real money once, not just inspected in
code.

## The lower-maintenance alternative

If the ongoing ops burden (patching a server, watching a Lightning node,
managing channel liquidity) isn't something you want to own indefinitely,
**Coinbase Commerce**, **BitPay**, or **OpenNode** (Lightning-focused) are
legitimate hosted alternatives — closer in shape to how Stripe already
works here: you get an API key, you don't run any infrastructure, and you
trade some of the "nobody but us touches this" property for someone else's
uptime and liquidity management. Worth explicitly deciding between these
with eyes open rather than defaulting into either — they're different
tradeoffs, not a strictly-better/worse pair.
