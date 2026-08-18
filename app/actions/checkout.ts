'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { findTierByPriceId } from '@/lib/pricingPlans';
import { findStandaloneProductByPriceId } from '@/lib/standaloneProducts';

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
    subscription_data: { trial_period_days: 14 },
    success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled`,
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

// One-time-purchase counterpart to createCheckoutSession above — mode:
// 'payment' against a persisted Stripe Price (see lib/standaloneProducts.ts)
// rather than a subscription. The Stripe Product backing that price already
// carries productId/product_type metadata, so the existing order webhook
// (handleProductOrderCompleted in app/api/webhooks/stripe/route.ts) records
// and fulfills it the same way it does any other digital product. It also
// reads supabase_user_id off this session's own metadata (same convention
// as createCheckoutSession above) to grant permanent feature access for
// products that need it — see grantEntitlementIfApplicable in the webhook.
export async function createStandaloneCheckoutSession(formData: FormData) {
  const priceId = formData.get('priceId');
  const userId = formData.get('userId');
  const userEmail = formData.get('userEmail');

  if (typeof priceId !== 'string') {
    throw new Error('Missing priceId.');
  }
  const product = findStandaloneProductByPriceId(priceId);
  if (!product) {
    throw new Error('Unknown product.');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured.');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const headersList = await headers();
  const origin = headersList.get('origin') || `http://${headersList.get('host') ?? 'localhost:3000'}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/products/${product.id}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/products/${product.id}`,
    customer_email: typeof userEmail === 'string' && userEmail ? userEmail : undefined,
    metadata: {
      supabase_user_id: typeof userId === 'string' ? userId : '',
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  redirect(session.url);
}

// The Hobby tier is genuinely free, not a $0 Stripe subscription — skipping
// Stripe entirely avoids collecting a payment method for a plan that will
// never be charged. Mirrors createCheckoutSession's pending-row pattern so
// the account shows up the same way in the subscriptions table, just with
// status 'active' immediately instead of waiting on a webhook.
export async function activateFreeTier(formData: FormData) {
  const userId = formData.get('userId');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('Supabase is not configured.');
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('subscriptions').insert({
    user_id: typeof userId === 'string' && userId ? userId : null,
    // No real Stripe session exists for a free-tier activation — synthesize
    // a unique id so this still satisfies the column's not-null/unique
    // constraint without colliding with real Stripe session ids.
    stripe_checkout_session_id: `free_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    tier: 'hobby',
    billing_interval: 'month',
    status: 'active',
  });
  if (error) {
    throw new Error(`Failed to activate free tier: ${error.message}`);
  }

  redirect('/dashboard');
}
