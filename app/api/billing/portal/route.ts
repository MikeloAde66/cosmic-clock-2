import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Same trust model as /api/subscription/status — the caller passes whatever
// user id its own client-side Supabase session already gave it (no
// server-side session to check against in this app). This only resolves
// which Stripe customer to open a portal session for, never charges or
// mutates anything, so that's an acceptable tradeoff here.
export async function POST(request: NextRequest) {
  const { userId } = await request.json().catch(() => ({ userId: null }));
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 });
  }

  try {
    const admin = getSupabaseAdmin();
    // Same query shape as /api/subscription/status — one active row per user.
    const { data, error } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (error || !data?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found for this user.' }, { status: 404 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error('Failed to create billing portal session:', err);
    return NextResponse.json({ error: 'Failed to open billing portal.' }, { status: 500 });
  }
}
