// Netlify Function: POST /api/create-checkout-session
// Builds a Stripe Checkout Session from the items in the cart and returns
// the hosted checkout URL. The frontend redirects the browser to that URL —
// card details are entered on Stripe's page, never on this site.
import Stripe from 'stripe';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const secretKey = Netlify.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY is not set — add it in Site configuration → Environment variables.');
    return Response.json(
      { error: 'Checkout is not configured yet. Please try again later.' },
      { status: 503 },
    );
  }
  const stripe = new Stripe(secretKey);

  try {
    const { items } = await req.json().catch(() => ({}));

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
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

    const origin = req.headers.get('origin') || new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      // Automatically collect and calculate tax if you've set up Stripe Tax.
      // automatic_tax: { enabled: true },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    return Response.json(
      { error: 'Unable to start checkout. Please try again.' },
      { status: 500 },
    );
  }
};
