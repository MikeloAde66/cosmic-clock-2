'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download } from 'lucide-react';
import Starfield from '@/components/Starfield';
import PurchaseButton from '@/components/PurchaseButton';
import { STANDALONE_PRODUCTS } from '@/lib/standaloneProducts';
import { STAR_TRACKER_LINK } from '@/lib/paymentLinks';

const product = STANDALONE_PRODUCTS.find((p) => p.id === 'star-tracker')!;

// Real capabilities only — StarTrackerView.tsx has no AI/ML in it anywhere;
// these are the actual astronomy-engine/satellite.js-backed calculations
// it runs. "Pass predictions" and "20 Hz" were dropped from an earlier
// draft of this copy — useIssTracker.ts only reports current live
// position (no rise/set search), and defaults to 1 Hz, not 20 Hz (a
// numeric display updating every 50ms burns battery for nothing
// perceptible).
const CAPABILITIES = [
  'World-Class Observatory Horizon Nodes: switch between your live IP-based location and famous research sites (Mauna Kea, Palomar, VLT Chile, Greenwich, Griffith) with real-time topocentric horizon recalculation',
  'Local SGP4 Orbital Engine: real-time ISS position propagation and live telemetry (azimuth, elevation, altitude), paired with a dual-tab live feed modal',
  'Messier Deep-Sky Overlay Catalog: real-time Alt/Az plotting for deep-space nebulae, galaxies, and star clusters mapped onto the starfield canvas',
  'Precision Sidereal & Kali Yuga Clocks: live synchronization of Local Time, Local Sidereal Time (LST), and cosmic epoch percentage metrics',
  'Live NOAA Space Weather Integration: real-time geomagnetic Kp index monitoring with human-readable storm-level status',
  'Sky Fest Event & Media Hub: automated countdowns for solar/lunar eclipses, active meteor showers with parent body tracking, and an integrated space video playlist player',
];

export default function StarTrackerProductPage() {
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
          <h1 className="text-4xl font-bold text-white">Star Tracker</h1>
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

        <div className="p-4 text-sm border rounded-lg border-neutral-700 bg-neutral-900/60 text-neutral-300">
          Already unlocked — the full Star Tracker experience is included in the $12/mo AiOne Pro plan.
          This one-time purchase is for standalone access on its own, outside the main app.
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">${(product.amountCents / 100).toFixed(2)}</span>
            <span className="text-sm text-neutral-500">one-time</span>
          </div>
          {/* Real guide content (accurate to the actual features above),
              served as a plain-text download — not labeled "(PDF)" since
              there's no PDF-generation tool available to produce a real
              binary PDF. */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="sm:flex-1">
              <PurchaseButton label="Purchase Star Tracker →" link={STAR_TRACKER_LINK} featured attachUserId />
            </div>
            <a
              href="/docs/Star_Tracker_QuickStart_Guide.txt"
              download="Star_Tracker_QuickStart_Guide.txt"
              className="flex items-center justify-center w-full gap-2 px-6 py-3 text-sm font-medium transition border rounded-lg sm:w-auto border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              Quick Start Guide
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
