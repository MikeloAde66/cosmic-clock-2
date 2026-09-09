'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download } from 'lucide-react';
import Starfield from '@/components/Starfield';
import PurchaseButton from '@/components/PurchaseButton';
import { STANDALONE_PRODUCTS } from '@/lib/standaloneProducts';
import { STAR_TRACKER_LINK, AIONE_PRO_SUBSCRIPTION_LINK } from '@/lib/paymentLinks';

const product = STANDALONE_PRODUCTS.find((p) => p.id === 'star-tracker')!;

// Real capabilities only — StarTrackerView.tsx has no AI/ML in it anywhere
// except Kali's own real LLM calls (DSN Telemetry and Deep Sky Spectrum's
// imagery below are both live external data, not model output); the rest
// are the actual astronomy-engine/satellite.js-backed calculations it runs.
const CAPABILITIES = [
  'World-Class Observatory Horizon Nodes: switch between your live location and real research sites (Mauna Kea, Palomar, VLT Chile, Greenwich, Griffith) with real-time topocentric horizon recalculation',
  'DSN Telemetry Engine: real-time NASA/JPL Deep Space Network downlink monitoring — live antenna locks, signal band and data rate, and light-time delay for active deep-space missions',
  'Deep Sky Spectrum: multi-wavelength galactic mapping (optical, infrared, radio, X-ray) with live Kali AI spectral summaries for selected deep-sky targets',
  'Precision Sidereal & Kali Yuga Clocks: live synchronization of Local Time, Local Sidereal Time (LST), and cosmic epoch percentage metrics',
  'Live NOAA Space Weather Integration: real-time geomagnetic Kp index monitoring with human-readable storm-level status',
];

type Tier = 'standalone' | 'pro';

export default function StarTrackerProductPage() {
  const [tier, setTier] = useState<Tier>('standalone');

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 max-w-2xl px-6 py-16 mx-auto space-y-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Products
        </Link>

        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/80">Standalone</p>
          <h1 className="text-4xl font-bold text-white">Star Tracker PRO</h1>
          <p className="text-sm text-neutral-400">
            Deep-space telemetry, real-time SGP4 orbital propagation, and observatory-grade horizon
            tracking — built on client-side astronomical algorithms, not stock imagery or static almanacs.
          </p>
        </div>

        <ul className="space-y-2.5">
          {CAPABILITIES.map((cap) => (
            <li key={cap} className="flex items-start gap-2 text-sm text-slate-300">
              <Check className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
              {cap}
            </li>
          ))}
        </ul>

        {/* Pricing comparison — two real, already-live Stripe products: this
            page's own $69 one-time standalone Price, and the same $12/mo
            AiOne Pro subscription Payment Link used across the rest of the
            app (PricingPlans.tsx, TrialGateModal.tsx). Toggle just switches
            which one is highlighted/purchasable here — neither number is
            invented for this page. */}
        <div className="space-y-4">
          <div className="inline-flex p-1 border rounded-lg border-neutral-700 bg-neutral-900/60">
            {(['standalone', 'pro'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wide rounded transition ${
                  tier === t ? 'bg-cyan-500/20 text-cyan-300' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t === 'standalone' ? 'Standalone' : 'AiOne Pro'}
              </button>
            ))}
          </div>

          {tier === 'standalone' ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">${(product.amountCents / 100).toFixed(2)}</span>
                <span className="text-sm text-neutral-500">one-time</span>
              </div>
              <p className="text-sm text-neutral-400">
                Perpetual standalone access to Star Tracker PRO on its own, outside the main AiOne hub.
              </p>
              <PurchaseButton label="Purchase Star Tracker PRO →" link={STAR_TRACKER_LINK} featured attachUserId />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">$12.00</span>
                <span className="text-sm text-neutral-500">/month</span>
              </div>
              <p className="text-sm text-neutral-400">
                Includes full access to Star Tracker PRO, Studio One, Media Flow, and every other AiOne
                hub feature. 14-day free trial, cancel anytime.
              </p>
              <PurchaseButton
                label="Start 14-Day Free Trial"
                link={AIONE_PRO_SUBSCRIPTION_LINK}
                featured
                pendingLabel="Subscription link pending"
                attachUserId
              />
            </div>
          )}

          <a
            href="/docs/Star_Tracker_PRO_Manual.pdf"
            download="Star_Tracker_PRO_Manual.pdf"
            className="flex items-center justify-center w-full gap-2 px-6 py-3 text-sm font-medium text-center transition border rounded-lg border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Download className="w-4 h-4 text-cyan-400 shrink-0" />
            Star Tracker PRO Technical Operations &amp; Telemetry Manual (.PDF)
          </a>
        </div>
      </div>
    </div>
  );
}
