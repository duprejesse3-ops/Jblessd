# Overdue Invoice Chaser

Pulls your real open invoices straight from Stripe, works out how many days
overdue each one is, and emails escalating reminders — friendly, firmer,
final — at the thresholds you set, automatically. Not a Make/Zapier
blueprint you assemble from scratch — a working script that does the whole
job the moment it's configured.

## How this differs from a reminder *checklist*

A checklist tells a human to go check Stripe and chase whoever's late. This
product does the chasing itself: it reads your actual open invoices, does
the days-overdue math, picks the right tone for how late each one is, and
sends the email — every day, without anyone remembering to do it. It also
keeps track of what it's already sent, so a customer 12 days late doesn't
get the "day 3" and "day 7" and "day 14" emails all at once, or the same
reminder twice.

## What it does, precisely

1. On a schedule (default: once daily — edit the cron in the workflow), it
   reads `config.json`: the escalation ladder — how many days overdue an
   invoice has to be before it gets a reminder, and what tone that reminder
   takes (e.g. day 3 = friendly, day 7 = firmer, day 14 = final notice).
2. It pulls every open invoice directly from Stripe's Invoices API,
   paginating through all of them, and skips anything with no due date set
   (nothing to chase there).
3. For each invoice, it computes exactly how many days overdue it is.
4. It checks `state.json` for which thresholds have already fired a
   reminder for that specific invoice, and sends a reminder only for the
   **highest threshold newly crossed** — so an invoice you haven't looked at
   in three weeks gets one email at the appropriate urgency, not a flood of
   catch-up emails for every threshold it passed along the way.
5. The reminder — a real HTML + plain-text email, sent via Resend — names
   the invoice, the amount, the due date, how many days overdue it is, and
   links straight to Stripe's hosted invoice page to pay.
6. `state.json` is updated so that threshold never fires again for this
   invoice, and pruned of invoices that are no longer open (paid, voided,
   or deleted) so it doesn't grow forever.
7. Optionally posts a one-line run digest to Slack: how many invoices are
   overdue, how many reminders went out, and the total dollar amount still
   outstanding.

It does not collect payment, adjust an invoice, or take any action inside
Stripe — it only reads open invoices and emails about them. You set the
escalation ladder once, and it acts on exactly that from then on.

## Install (10 minutes)

1. Copy `bin/`, `lib/`, and `config.example.json` into your repo — anywhere,
   e.g. `tools/invoice-chaser/`.
2. Copy `config.example.json` to `config.json` in that same folder and edit
   it: your own escalation days and reminder labels.
3. Copy `.github-workflow-template/invoice-chaser.yml` to
   `.github/workflows/invoice-chaser.yml` (this exact path — GitHub only
   runs workflows from there).
4. If you put `bin/`/`lib/` somewhere other than `tools/invoice-chaser/`,
   edit the `working-directory:` lines in the workflow to match.
5. Add repo secrets (**Settings → Secrets and variables → Actions**):
   - `STRIPE_SECRET_KEY` — from a restricted Stripe key with **read** access
     to Invoices (dashboard.stripe.com/apikeys)
   - `RESEND_API_KEY` — from resend.com. **Leave unset to dry-run**:
     reminders are still computed and logged every run, just never sent,
     and `state.json` is not updated for anything that wasn't actually
     sent — a safe way to watch it for a few cycles before it emails a
     real customer.
   - `CHASER_FROM_EMAIL` — a verified sending address on your Resend domain
   - `SLACK_WEBHOOK_URL` (optional) — Slack → Apps → Incoming Webhooks
   - `STORE_NAME` (optional) — appears in the reminder subject/body
6. Commit and push. It runs on the schedule automatically, or trigger it
   once immediately from the **Actions** tab (`workflow_dispatch`) to check
   it actually works before waiting for the cron. The included workflow
   commits the updated `state.json` back to the repo after each run so
   dedupe state survives between runs — see the comment at the top of the
   workflow file if you'd rather store it another way.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in STRIPE_SECRET_KEY, RESEND_API_KEY, etc.
cp config.example.json config.json   # edit with your real escalation ladder
node bin/chase.mjs
```

Leave `RESEND_API_KEY` blank in `.env` for your first run — you'll see
exactly which reminders *would* go out and to whom, logged to the console,
with nothing actually sent and no `state.json` entries written for them.

```sh
npm test
```
Runs without any real API keys or network calls — checks the days-overdue
math, the escalation-threshold selection (including the catch-up/no-flood
behavior), the dedupe state tracking, the email content builder, and config
validation against known inputs, not a live Stripe or Resend call.

## On state.json

This product tracks, per invoice, which escalation thresholds have already
sent a reminder — that's the entire job of `state.json`, and it's the only
state this product keeps. It's a plain JSON file, not a database, so you can
read it, edit it, or delete an invoice's entry by hand if you ever need to
force a reminder to re-fire. If `state.json` goes missing entirely (a fresh
checkout, a wiped cache), the next run treats every invoice as never having
been reminded — it will re-send the appropriate threshold for anything
currently overdue, once.

## License

See `LICENSE.md`. One-time purchase, for your own use — run it against
unlimited Stripe accounts and invoices, not for resale as a standalone
product.
