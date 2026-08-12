'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { findTierByPriceId } from '@/lib/pricingPlans';

// Server Actions are effectively public, unauthenticated POST endpoints —
// the plan being checked out is validated against our own known price IDs
// (not trusted blindly from the form), and there's no server-side session
// to authenticate against in this app yet (Supabase Auth here is
// browser-client-only), so the calling component passes along whatever
// user id/email it already has from its own client-side session check.
export async function createCheckoutSession(formData: FormData) {
  const priceId = formData.get('priceId');
  const userId = formData.get('userId');
  const userEmail = formData.get('userEmail');

  if (typeof priceId !== 'string') {
    throw new Error('Missing priceId.');
  }
  const tier = findTierByPriceId(priceId);
  if (!tier) {
    throw new Error('Unknown pricing plan.');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured.');
  }

  const interval = priceId === tier.yearlyPriceId ? 'year' : 'month';
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const headersList = await headers();
  const origin = headersList.get('origin') || `http://${headersList.get('host') ?? 'localhost:3000'}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?subscribed=success`,
    cancel_url: `${origin}/?subscribed=cancelled`,
    customer_email: typeof userEmail === 'string' && userEmail ? userEmail : undefined,
    metadata: {
      supabase_user_id: typeof userId === 'string' ? userId : '',
      tier: tier.id,
      interval,
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  // Best-effort: record the attempt so the webhook has a row to update once
  // the subscription actually activates. Never block checkout on this —
  // Stripe is the source of truth either way.
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const admin = getSupabaseAdmin();
      await admin.from('subscriptions').insert({
        user_id: typeof userId === 'string' && userId ? userId : null,
        stripe_checkout_session_id: session.id,
        stripe_price_id: priceId,
        tier: tier.id,
        billing_interval: interval,
        status: 'incomplete',
      });
    }
  } catch (err) {
    console.error('Failed to record pending subscription (continuing to checkout regardless):', err);
  }

  redirect(session.url);
}
