'use client';

import React from 'react';
import { ArrowLeft, Satellite } from 'lucide-react';
import Starfield from './Starfield';
import DsnTelemetryPanel from './hud/DsnTelemetryPanel';

// Dedicated full view (not a stacked modal — see StarTrackerProCanvas's own
// note on this) for the "[ VIEW LIVE DSN TELEMETRY ]" hero trigger. Reuses
// the same DsnTelemetryPanel the live app's HUD embeds in miniature, just
// given its own full-screen showcase here instead of a cramped tab.
export default function StarTrackerDsnView({ onBack, leaving }: { onBack: () => void; leaving?: boolean }) {
  return (
    <div
      className={`${leaving ? 'star-tracker-view-exit' : 'star-tracker-view-enter'} fixed inset-0 z-50 w-full h-full overflow-y-auto bg-[#050810] text-slate-100`}
    >
      <Starfield />

      <div className="relative z-10 flex flex-col w-full min-h-full p-6 sm:p-12">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center self-start gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border bg-slate-900/70 border-slate-700 text-white/80 hover:border-slate-500 hover:text-white backdrop-blur-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="max-w-2xl mx-auto my-auto w-full space-y-6 py-12">
          <div className="flex items-center gap-3">
            <Satellite className="w-6 h-6 text-cyan-400" />
            <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              DEEP SPACE NETWORK — LIVE TELEMETRY
            </h1>
          </div>
          <p className="text-sm text-slate-400 font-mono">
            Real-time NASA/JPL DSN Now downlink data: active antenna locks, signal band, data rate, and one-way
            light-time for every spacecraft currently in contact.
          </p>

          <div className="p-4 border rounded-lg border-cyan-500/20 bg-slate-900/40 backdrop-blur-sm">
            <DsnTelemetryPanel active />
          </div>
        </div>
      </div>
    </div>
  );
}
