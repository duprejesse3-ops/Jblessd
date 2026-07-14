// Optional but recommended once you're live: Stripe calls this endpoint
// directly when a payment succeeds, which is more reliable than trusting
// the browser to reach the success page (people close tabs, lose wifi, etc).
// This is where you'd trigger delivery of the actual files/download links.
import Stripe from 'stripe'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  const stripe = new Stripe(Netlify.env.get('STRIPE_SECRET_KEY'))
  const sig = req.headers.get('stripe-signature')
  let event

  try {
    // Stripe needs the raw request body to verify the signature.
    const rawBody = await req.text()
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      Netlify.env.get('STRIPE_WEBHOOK_SECRET'),
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    // TODO: this is where real fulfillment happens, e.g.:
    //  - look up session.customer_details.email
    //  - email the buyer their download links (Resend, Postmark, SendGrid, etc.)
    //  - or log the order to a database
    console.log('Payment completed for session:', session.id, session.customer_details?.email)
  }

  return Response.json({ received: true })
}
