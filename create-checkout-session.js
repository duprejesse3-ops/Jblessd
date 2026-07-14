// Vercel serverless function: /api/create-checkout-session
// Builds a Stripe Checkout Session from the items in the cart and returns
// the hosted checkout URL. The frontend redirects the browser to that URL —
// card details are entered on Stripe's page, never on this site.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Basic server-side sanity checks — never trust price/name straight
    // from the client without at least bounding them.
    const line_items = items.map((item) => {
      const price = Math.round(parseFloat(item.price) * 100);
      if (!item.name || !Number.isFinite(price) || price <= 0) {
        throw new Error('Invalid item in cart');
      }
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: String(item.name).slice(0, 200),
            metadata: item.id ? { sku: String(item.id).slice(0, 100) } : undefined,
          },
          unit_amount: price,
        },
        quantity: 1,
      };
    });

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      // Automatically collect and calculate tax if you've set up Stripe Tax.
      // automatic_tax: { enabled: true },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    return res.status(500).json({ error: 'Unable to start checkout. Please try again.' });
  }
};
