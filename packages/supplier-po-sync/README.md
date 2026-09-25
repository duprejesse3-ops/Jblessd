# Supplier PO & Inventory Sync

Checks your real Shopify stock against reorder thresholds you set, and — when
something crosses one — generates and emails an actual purchase order (a real
CSV attachment, a real email, to the actual supplier) automatically. Not a
Make/Zapier blueprint you assemble from scratch — a working script that does
the whole job the moment it's configured.

## How this differs from a low-stock *alert*

If you already own **MultiConnect: Shopify**, that product tells you a SKU
crossed its threshold. This product is the next step: it turns that moment
into a real purchase order in your supplier's inbox, with no human copying
numbers into a spreadsheet in between. They work well together, but this one
also runs completely standalone — it talks to Shopify directly and needs
nothing else installed.

## What it does, precisely

1. On a schedule (default: every 6 hours — edit the cron in the workflow),
   it reads `config.json`: the SKUs you're watching, each one's reorder
   threshold and reorder quantity, and which supplier to email.
2. It looks up each SKU's current stock directly from Shopify's Admin API.
3. Anything at or below its threshold gets grouped by supplier — one
   supplier with three low SKUs gets **one** combined PO, not three emails.
4. For each supplier that needs one: builds a real purchase order (a
   sequential PO number, a line-item CSV with quantities and costs, a plain
   -text email body) and sends it via Resend.
5. Optionally posts a one-line run summary to Slack either way — even "ran,
   nothing needed reordering" — so you know the job is alive without
   checking logs.

It does not place the order with the supplier's own system, negotiate
pricing, or guess a reorder quantity for you — you set the threshold and
quantity per SKU once, and it acts on exactly that from then on.

## Install (10 minutes)

1. Copy `bin/`, `lib/`, and `config.example.json` into your repo — anywhere,
   e.g. `tools/supplier-po-sync/`.
2. Copy `config.example.json` to `config.json` in that same folder and edit
   it: your real SKUs, thresholds, reorder quantities, and supplier emails.
3. Copy `.github-workflow-template/supplier-po-sync.yml` to
   `.github/workflows/supplier-po-sync.yml` (this exact path — GitHub only
   runs workflows from there).
4. If you put `bin/`/`lib/` somewhere other than `tools/supplier-po-sync/`,
   edit the `working-directory:` line in the workflow to match.
5. Add repo secrets (**Settings → Secrets and variables → Actions**):
   - `SHOPIFY_STORE` — `your-shop.myshopify.com`
   - `SHOPIFY_ACCESS_TOKEN` — from a Shopify custom app with `read_inventory`
     + `read_products` scopes (Settings → Apps and sales channels → Develop
     apps)
   - `RESEND_API_KEY` — from resend.com. **Leave unset to dry-run**: POs are
     still built and logged every run, just never sent — a safe way to watch
     it for a few cycles before it emails a real supplier.
   - `PO_FROM_EMAIL` — a verified sending address on your Resend domain
   - `SLACK_WEBHOOK_URL` (optional) — Slack → Apps → Incoming Webhooks
   - `STORE_NAME` (optional) — appears in the PO subject/body
6. Commit and push. It runs on the schedule automatically, or trigger it
   once immediately from the **Actions** tab (`workflow_dispatch`) to check
   it actually works before waiting for the cron.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in SHOPIFY_STORE, SHOPIFY_ACCESS_TOKEN, etc.
cp config.example.json config.json   # edit with your real SKUs/suppliers
node bin/sync.mjs
```

Leave `RESEND_API_KEY` blank in `.env` for your first run — you'll see
exactly what PO each supplier *would* get, logged to the console, with
nothing actually sent.

```sh
npm test
```
Runs without any real API keys or network calls — checks the threshold
logic, PO/CSV builder, and config validation against known inputs, not a
live Shopify or Resend call.

## On duplicate POs

This product has no database — each run is independent. If a SKU is still
below threshold on the next run before you've restocked it, you'll get
another PO for it. In practice this is rarely a problem (suppliers are used
to a follow-up PO on the same line, and most reorder cycles are longer than
this job's schedule), but if it matters to you: raise the schedule interval
in the workflow (e.g. once daily instead of every 6 hours), or track sent POs
yourself in a small file/database and skip a SKU that already has one open —
`bin/sync.mjs` is plain, readable JavaScript specifically so you can extend
it.

## License

See `LICENSE.md`. One-time purchase, for your own use — run it on unlimited
SKUs and suppliers, not for resale as a standalone product.
