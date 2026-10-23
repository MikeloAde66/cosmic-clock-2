'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionStatus } from '@/lib/subscriptionStatus';
import { PRICING_TIERS } from '@/lib/pricingPlans';
import Starfield from '@/components/Starfield';

type GuardState = 'checking' | 'signed-out' | 'ready';

export default function BillingPage() {
  const router = useRouter();
  const [guard, setGuard] = useState<GuardState>('checking');
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [tierId, setTierId] = useState<string | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!cancelled) setGuard('signed-out');
        return;
      }

      const status = await checkSubscriptionStatus(user.id);
      if (cancelled) return;

      setUserId(user.id);
      setEmail(user.email ?? null);
      setActive(status.active);
      setTierId(status.tier);
      setGuard('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleManageBilling = async () => {
    if (!userId) return;
    setOpening(true);
    setPortalError(null);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setPortalError(data.error || 'Failed to open billing portal.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError('Failed to open billing portal.');
    } finally {
      setOpening(false);
    }
  };

  if (guard === 'checking') {
    return (
      <div className="flex items-center justify-center w-full h-screen text-sm font-mono text-neutral-500">
        Verifying your session…
      </div>
    );
  }

  if (guard === 'signed-out') {
    return (
      <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
        <Starfield />
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-screen gap-4 px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Billing</p>
          <h1 className="text-2xl font-bold text-white">Sign in to manage your billing</h1>
          <p className="max-w-sm text-sm text-neutral-400">
            New here? Every plan starts with a 14-day free trial, from $12 a month.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <button
              onClick={() => router.replace('/?auth=login')}
              className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200"
            >
              Sign in
            </button>
            <button
              onClick={() => router.replace('/?checkout=required')}
              className="px-5 py-2.5 text-xs font-mono uppercase tracking-wide border rounded-lg bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-neutral-200"
            >
              See plans
            </button>
          </div>
          <button onClick={() => router.replace('/')} className="mt-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-300">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const tier = PRICING_TIERS.find((t) => t.id === tierId);

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 max-w-xl px-6 py-16 mx-auto space-y-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Billing</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Manage your subscription</h1>
          {email && <p className="mt-2 text-sm text-neutral-400">{email}</p>}
        </div>

        <div className="p-5 space-y-3 border rounded-xl border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Status</span>
            <span className={`text-sm font-semibold ${active ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {active ? 'Active' : 'No active subscription'}
            </span>
          </div>
          {active && tier && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">Plan</span>
              <span className="text-sm font-semibold text-white">{tier.name}</span>
            </div>
          )}
        </div>

        {active ? (
          <div className="space-y-3">
            <button
              onClick={handleManageBilling}
              disabled={opening}
              className="w-full px-4 py-3 text-sm font-semibold text-black transition bg-white rounded-lg hover:bg-neutral-200 disabled:opacity-60"
            >
              {opening ? 'Opening…' : 'Manage Billing & Payment Methods'}
            </button>
            {portalError && <p className="text-xs text-rose-400">{portalError}</p>}
            <p className="text-xs text-neutral-500">
              Opens Stripe&apos;s secure billing portal — update your card, view invoices, or cancel anytime.
            </p>
          </div>
        ) : (
          <button
            onClick={() => router.replace('/?checkout=required')}
            className="w-full px-4 py-3 text-sm font-semibold text-black transition bg-white rounded-lg hover:bg-neutral-200"
          >
            View Plans
          </button>
        )}
      </div>
    </div>
  );
}
