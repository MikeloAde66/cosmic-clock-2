'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Telescope, Plane, Radio } from 'lucide-react';
import PurchaseButton from '@/components/PurchaseButton';
import { HUB_PLANS, CONNECTIVITY, TRIAL_DAYS, type BillingInterval } from '@/lib/hubPlans';

// Hub pricing: Free plus three paid plans, monthly or yearly (two months
// free), each starting with a 14-day trial. Plan data and the Stripe
// Payment Links live in lib/hubPlans.ts; a plan whose link isn't set yet
// shows "Coming soon" rather than a dead button.

const CONNECT_ICONS = { Telescopes: Telescope, Drones: Plane, 'Radio & controllers': Radio } as const;

export default function PricingPlans() {
  const [interval, setBilling] = useState<BillingInterval>('monthly');

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-6xl px-4 py-10 mx-auto space-y-10 sm:px-6">
        <div className="space-y-3 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-400">Ai One Plans</p>
          <h2 className="text-3xl font-bold text-white text-balance">One hub. Every app. Start free for {TRIAL_DAYS} days.</h2>
          <p className="max-w-xl mx-auto text-sm text-slate-400">
            Every paid plan starts with a {TRIAL_DAYS}-day free trial. Cancel anytime before it ends and you won&apos;t be
            charged.
          </p>

          <div className="inline-flex p-1 mt-2 border rounded-full border-slate-700 bg-slate-900/60" role="group" aria-label="Billing period">
            {(['monthly', 'yearly'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setBilling(k)}
                aria-pressed={interval === k}
                className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wide rounded-full transition ${
                  interval === k ? 'bg-white text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {k === 'monthly' ? 'Monthly' : 'Yearly · 2 months free'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HUB_PLANS.map((plan) => {
            const isFree = plan.monthly === 0;
            const price = interval === 'monthly' ? plan.monthly : plan.yearly;
            const link = plan.links[interval];
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col p-6 rounded-xl border bg-[#0B0E14]/80 backdrop-blur-sm ${
                  plan.featured
                    ? 'border-cyan-400/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]'
                    : 'border-slate-800'
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-2.5 left-6 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide rounded bg-cyan-400 text-slate-950">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mt-4">
                  <span className="text-3xl font-bold text-white tabular-nums">${price}</span>
                  <span className="text-xs text-slate-500">{isFree ? 'forever' : interval === 'monthly' ? '/month' : '/year'}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 h-4">
                  {isFree
                    ? 'No card needed.'
                    : interval === 'monthly'
                      ? `$${plan.yearly}/year if billed yearly`
                      : `Works out to $${(plan.yearly / 12).toFixed(2)}/month`}
                </p>

                <ul className="flex-1 mt-5 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-cyan-400" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isFree ? (
                    <Link
                      href="/?auth=signup"
                      className="block w-full py-3 text-sm font-mono font-bold uppercase tracking-wide text-center rounded-lg transition bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-slate-500"
                    >
                      Create free account
                    </Link>
                  ) : (
                    <PurchaseButton
                      label={`Start ${TRIAL_DAYS}-day free trial`}
                      link={link}
                      featured={plan.featured}
                      pendingLabel="Coming soon"
                      attachUserId
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <section className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">Connect real hardware</h3>
            <p className="mt-1 text-xs text-slate-400">Pro and Advanced link the hub to the gear on your desk and in the field.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CONNECTIVITY.map((c) => {
              const Icon = CONNECT_ICONS[c.title as keyof typeof CONNECT_ICONS];
              return (
                <div key={c.title} className="p-5 border rounded-xl border-slate-800 bg-[#0B0E14]/80">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                      {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
                      {c.title}
                    </h4>
                    <span className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">{c.plan}+</span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-slate-500">{c.note}</p>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-center text-[11px] text-slate-500">
          Prices in USD. Your trial converts to the plan you choose after {TRIAL_DAYS} days unless you cancel. Manage or
          cancel anytime from Billing.
        </p>
      </div>
    </div>
  );
}
