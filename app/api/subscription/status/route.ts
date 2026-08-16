import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Same trust model as app/actions/checkout.ts's userId handling — Supabase
// Auth in this app is browser-client-only (no server-side session to check
// against), so the caller passes whatever user id its own client-side
// session already gave it. This only gates a redirect decision, not a
// write or a real resource, so that's an acceptable tradeoff here.
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ active: false });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('subscriptions')
      .select('tier, billing_interval')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to check subscription status:', error);
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: !!data,
      tier: data?.tier,
      billingInterval: data?.billing_interval,
    });
  } catch (err) {
    // getSupabaseAdmin() throws if Supabase isn't configured — fail closed
    // (treat as not subscribed) rather than crash the caller's guard check.
    console.error('Subscription status check unavailable:', err);
    return NextResponse.json({ active: false });
  }
}
