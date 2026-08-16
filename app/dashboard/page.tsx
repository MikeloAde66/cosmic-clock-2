'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionStatus } from '@/lib/subscriptionStatus';
import { PRICING_TIERS } from '@/lib/pricingPlans';
import Starfield from '@/components/Starfield';

type GuardState = 'checking' | 'denied' | 'granted';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [guard, setGuard] = useState<GuardState>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [tierId, setTierId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        // Not signed in at all — nothing to guard, just send them to the
        // landing page rather than showing an empty dashboard.
        router.replace('/');
        return;
      }

      const status = await checkSubscriptionStatus(user.id);
      if (cancelled) return;

      if (!status.active) {
        // Signed in, but no active plan — back to the landing page's
        // pricing section rather than a dead-end dashboard.
        router.replace('/?checkout=required');
        return;
      }

      setEmail(user.email ?? null);
      setTierId(status.tier);
      setGuard('granted');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (guard !== 'granted') {
    return (
      <div className="flex items-center justify-center w-full h-screen text-sm font-mono text-neutral-500">
        Verifying your session…
      </div>
    );
  }

  const tier = PRICING_TIERS.find((t) => t.id === tierId);

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 max-w-3xl px-6 py-16 mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Dashboard</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Welcome back{email ? `, ${email}` : ''}</h1>
            {tier && (
              <p className="mt-2 text-sm text-neutral-400">
                Active plan: <span className="font-semibold text-white">{tier.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 text-xs border rounded bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-neutral-300 shrink-0"
          >
            Sign Out
          </button>
        </div>

        {sessionId && (
          <div className="p-4 text-sm border rounded-lg border-emerald-800/60 bg-emerald-950/30 text-emerald-300">
            Subscription confirmed. You're all set.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/?tab=radio"
            className="block p-5 space-y-1 transition border rounded-xl border-neutral-800 bg-neutral-900/60 hover:border-neutral-600"
          >
            <h2 className="text-sm font-bold text-white">Radio Broadcast Hub</h2>
            <p className="text-xs text-neutral-500">Live and on-demand stations.</p>
          </Link>
          <Link
            href="/"
            className="block p-5 space-y-1 transition border rounded-xl border-neutral-800 bg-neutral-900/60 hover:border-neutral-600"
          >
            <h2 className="text-sm font-bold text-white">Star Tracker &amp; Live ISS</h2>
            <p className="text-xs text-neutral-500">Open from the top bar on the main app.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center w-full h-screen text-sm font-mono text-neutral-500">
          Loading…
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
