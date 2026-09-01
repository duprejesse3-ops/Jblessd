# Deploying jblessd.com with working Stripe checkout (Netlify)

This project has two parts:
- **Static site**: `index.html`, `multiniche-ai-og.png`, `robots.txt`, `sitemap.xml`
- **Serverless functions**: `netlify/functions/create-checkout-session.mts` (required), `netlify/functions/webhook.mts` (fulfillment — see section 7, already wired to Resend), `netlify/functions/create-custom-checkout-session.mts`, `netlify/functions/checkout-summary.mts`, and the rest of `netlify/functions/`
- **`netlify.toml`**: tells Netlify where the functions live and redirects `/api/*` to them, so the frontend code doesn't need to change

## 1. Create a Stripe account
1. Sign up at stripe.com
2. In the Dashboard, toggle to **Test mode** (top right) while setting up
3. Go to **Developers → API keys** and copy the **Secret key** (starts with `sk_test_...`)

## 2. Update your Netlify site (jblessd81)
You already have a site connected — you just need to add these files and an environment variable.

1. Push all files in this project (including `netlify.toml` and the `netlify/functions/` folder) to whatever repo your Netlify site deploys from. If you deployed by drag-and-drop originally, switch to a Git-connected deploy now — Netlify Functions need to be built from a repo, not a plain file drop.
2. In the Netlify dashboard → your site (**jblessd81**) → **Site configuration → Environment variables** → add:
   - `STRIPE_SECRET_KEY` = your `sk_test_...` key
3. Trigger a deploy (pushing to the repo does this automatically)
4. Once deployed, confirm the function is live by checking **Site configuration → Functions** — you should see `create-checkout-session` listed

## 3. Connect your domain
If `jblessd.com` isn't attached to this Netlify site yet: **Site configuration → Domain management → Add a domain** → follow the DNS instructions at your registrar.

## 4. Test a purchase
1. Visit your live site, add items to cart, hit Checkout
2. On Stripe's page, use a test card: `4242 4242 4242 4242`, any future expiry, any CVC
3. You should land back on your site with a "Payment successful" message
4. Check **Stripe Dashboard → Payments** to confirm the test payment shows up

## 5. Go live
1. In Stripe, complete account activation (business details, bank account for payouts)
2. Switch the Dashboard out of Test mode, copy your **live** secret key (`sk_live_...`)
3. In Netlify → Environment variables, update `STRIPE_SECRET_KEY` to the live key
4. Redeploy

## 6. Delivering the products (already wired up)
Checkout success triggers automated fulfillment: `netlify/functions/webhook.mts` listens for Stripe's payment event and emails the buyer their deliverable/download link via Resend (see section 7 below for the required environment variables). In Stripe Dashboard → Developers → Webhooks, add an endpoint pointing to `https://jblessd.com/api/webhook` and copy the signing secret into Netlify as `STRIPE_WEBHOOK_SECRET`.

If `RESEND_API_KEY` / `EMAIL_FROM` aren't set yet, email sends are a graceful no-op (logged, not sent) rather than an error — see section 7 — so you can deploy and test checkout before turning email on. Until then, fall back to manually emailing buyers their link (Stripe shows their email under Payments).

## Notes
- The secret key must only ever live in Netlify's environment variables — never in the HTML or committed to your repo
- Test mode and live mode are fully separate; test payments never touch real money

## 7. Email delivery (free-pack, order receipts, weekly digest)
The site sends transactional email through [Resend](https://resend.com) via a shared sender (`netlify/lib/email.mts`).
It is used for three things: delivering the free prompt pack to lead-magnet signups, sending an order receipt / review
ask after a Stripe purchase, and the weekly subscriber digest (`netlify/functions/subscriber-digest.mts`).

Email is **optional to boot**: with no key configured every send is a graceful no-op (it logs and moves on), so the site
deploys and runs fine before you set this up. To turn delivery on, add **both** of these environment variables in Netlify →
Site configuration → Environment variables (email stays off unless both are present, since sending from Resend's shared
sandbox address only reaches the account owner):
- `RESEND_API_KEY` — your Resend API key
- `EMAIL_FROM` — the verified From address, e.g. `MULTINICHE AI <hello@jblessd.com>` (must be a domain you've verified in Resend)

The weekly digest is a scheduled function and only runs on **published production deploys**, never on previews.

## 8. When a deploy fails at "Netlify Database setup"

Because `@netlify/database` is a dependency, every build runs a **Netlify Database setup** step before anything else is
compiled. On production it just resolves the connection string; on a deploy preview or branch deploy it also creates a
*database branch* named after the git branch, so the preview gets its own isolated copy of the data and can never write
to the live store.

That step is platform-side — it runs before the site's own build and there is nothing in this repository that can catch
or skip it. When it fails the whole deploy stops with:

```
API error on "createSiteDatabaseBranch"
  Error message: Internal Server Error
```

Nothing is wrong with the committed code when you see this. Two things cause it:

1. **A transient Netlify API error.** Retry the deploy ("Retry with latest branch commit" in the Netlify UI, or push an
   empty commit). This clears it most of the time.
2. **Stale database branches piling up.** Every branch deploy leaves a database branch behind, and each agent run and
   pull request creates a new one. Once the database's branch allowance is used up, new branch creation starts erroring
   instead of failing cleanly. Delete the branches for merged/abandoned work under **Site configuration → Database** in
   the Netlify dashboard, then retry. Production data is untouched by this — branches are copies.

Production deploys never call `createSiteDatabaseBranch` at all, so a live site already published is unaffected while
you sort this out.
