import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Completes the loop the checkout Server Action starts: it inserts an
// 'incomplete' row keyed by the Checkout Session id before redirecting to
// Stripe; this endpoint fills in the real subscription/customer ids and
// status once Stripe confirms what actually happened. Requires a webhook
// endpoint configured in the Stripe dashboard (or `stripe listen --forward-to
// .../api/webhooks/stripe` for local dev) pointed here, with its signing
// secret set as STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe webhook is not configured.', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header.', { status: 400 });
  }

  const body = await request.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return new Response('Invalid signature.', { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await admin
          .from('subscriptions')
          .update({
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_checkout_session_id', session.id);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await admin
          .from('subscriptions')
          .update({ status: subscription.status, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        // Unhandled event types are expected — Stripe sends far more than
        // we care about tracking; only ack them.
        break;
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling error:', err);
    const message = err instanceof Error ? err.message : 'Webhook handling failed.';
    return new Response(message, { status: 500 });
  }
}
