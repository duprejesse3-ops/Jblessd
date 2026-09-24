# MultiConnect: Shopify

Give your AI agent real-time access to your Shopify store.

Runs entirely on your own machine: a local dashboard for connecting your
store's Admin API, watching orders and inventory come in live, and getting
instant low-stock alerts — with a safe-mode switch that keeps your agent
read-only until you deliberately turn it off.

## Install

**Windows**

```powershell
.\install.ps1
```

**macOS / Linux**

```bash
./install.sh
```

Either way, this starts the connector in the foreground and prints a
dashboard URL, a local auth token, and the webhook URL to add in Shopify.

## Setting up your Shopify store

1. In your Shopify admin, go to **Settings → Apps and sales channels →
   Develop apps**, create an app, and give it Admin API access with these
   scopes: `read_products`, `read_orders`, and (only if you plan to use
   read/write mode) `write_products`, `write_inventory`.
2. Copy the **Admin API access token** into the dashboard's Connect section.
3. Go to **Settings → Notifications → Webhooks**, create webhooks for
   `Order creation` and `Inventory level update`, pointing at the webhook
   URL the dashboard shows you, and copy the **webhook signing secret**
   into the dashboard too.

## Safe mode

Every install starts **read-only** — your agent can see products, orders,
and inventory, but cannot change anything in your store. Switch to
**read/write** in the dashboard only when you're ready to let the agent
update prices or adjust stock. Every write call checks this setting first
and refuses outright if it's not explicitly enabled — there's no way to
bypass it from the agent side.

## Using it

- **Product & inventory sync** — your agent calls `GET /api/products` with
  your dashboard token to pull current products, prices, and variants.
- **Order visibility** — `GET /api/orders` pulls recent orders; the
  `orders/create` webhook also logs new orders live in the dashboard the
  moment they happen.
- **Instant triggers** — inventory webhooks are checked against your
  configured low-stock threshold automatically; anything at or below it is
  flagged in the activity log.

## Development

```bash
npm test
```

Zero dependencies — plain Node.js (18+), no build step.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license. You
own your copy forever; you may not resell the software itself.
