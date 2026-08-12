'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PRICING_TIERS } from '@/lib/pricingPlans';
import { createCheckoutSession } from '@/app/actions/checkout';

function formatPrice(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export default function PricingPlans() {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? '' });
      }
    });
  }, []);

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-6xl px-6 py-10 mx-auto space-y-8">
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold text-white">Pricing Plans</h2>
          <p className="max-w-lg mx-auto text-sm text-slate-400">
            Start building for free, then subscribe when you&apos;re ready to go live.
          </p>

          <div className="inline-flex p-1 mt-2 border rounded-lg bg-slate-900/80 border-slate-800">
            <button
              onClick={() => setBillingInterval('month')}
              className={`px-4 py-1.5 rounded-md text-xs font-mono uppercase tracking-wide transition ${
                billingInterval === 'month'
                  ? 'bg-white/20 text-white border border-neutral-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingInterval('year')}
              className={`px-4 py-1.5 rounded-md text-xs font-mono uppercase tracking-wide transition ${
                billingInterval === 'year'
                  ? 'bg-white/20 text-white border border-neutral-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yearly billing
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_TIERS.map((tier) => {
            const priceId = billingInterval === 'year' ? tier.yearlyPriceId : tier.monthlyPriceId;
            const amount = billingInterval === 'year' ? tier.yearlyAmount : tier.monthlyAmount;

            return (
              <div
                key={tier.id}
                className={`flex flex-col justify-between p-5 space-y-4 border rounded-xl bg-[#0B0E14]/80 backdrop-blur-sm transition ${
                  tier.featured
                    ? 'border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{tier.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{tier.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">${formatPrice(amount)}</span>
                    <span className="text-xs text-slate-500">/{billingInterval === 'year' ? 'year' : 'month'}</span>
                  </div>

                  <ul className="space-y-1.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 mt-0.5 text-white/70 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <form action={createCheckoutSession}>
                  <input type="hidden" name="priceId" value={priceId} />
                  <input type="hidden" name="userId" value={user?.id ?? ''} />
                  <input type="hidden" name="userEmail" value={user?.email ?? ''} />
                  <button
                    type="submit"
                    className={`w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg transition ${
                      tier.featured
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-slate-900/60 border border-neutral-700 text-white/80 hover:border-neutral-500 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
