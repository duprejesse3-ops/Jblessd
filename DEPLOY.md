# Deploying jblessd.com with working Stripe checkout (Netlify)

This project has two parts:
- **Static site**: `index.html`, `og-image.png`, `robots.txt`, `sitemap.xml`
- **Serverless functions**: `netlify/functions/create-checkout-session.js` (required), `netlify/functions/webhook.js` (optional, for fulfillment)
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

## 6. Actually delivering the products (important — not yet wired up)
Right now, checkout success just shows a message. Stripe does **not** know these are digital templates/prompts, so it won't email files automatically. Pick one:

- **Easiest**: after each sale, manually email the buyer their download link (Stripe shows their email under Payments)
- **Automated**: use `netlify/functions/webhook.js` — in Stripe Dashboard → Developers → Webhooks, add an endpoint pointing to `https://jblessd.com/api/webhook`, copy the signing secret into Netlify as `STRIPE_WEBHOOK_SECRET`, then have that function trigger an email via a service like Resend or Postmark with the download link
- **Skip building this yourself**: this exact problem (checkout + automatic file delivery) is what Gumroad or Lemon Squeezy solve out of the box, if you'd rather not maintain the webhook/email piece

## Notes
- The secret key must only ever live in Netlify's environment variables — never in the HTML or committed to your repo
- Test mode and live mode are fully separate; test payments never touch real money
