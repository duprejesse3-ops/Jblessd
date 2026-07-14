// Vercel serverless function: /api/webhook
// Optional but recommended once you're live: Stripe calls this endpoint
// directly when a payment succeeds, which is more reliable than trusting
// the browser to reach the success page (people close tabs, lose wifi, etc).
// This is where you'd trigger delivery of the actual files/download links.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripe needs the raw request body to verify the signature, so we turn off
// Vercel's automatic JSON body parsing for this route.
module.exports.config = {
  api: { bodyParser: false },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // TODO: this is where real fulfillment happens, e.g.:
    //  - look up session.customer_details.email
    //  - email the buyer their download links (Resend, Postmark, SendGrid, etc.)
    //  - or log the order to a database / Google Sheet
    console.log('Payment completed for session:', session.id, session.customer_details?.email);
  }

  return res.status(200).json({ received: true });
};
