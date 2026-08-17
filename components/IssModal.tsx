'use client';

import React from 'react';
import { useIssTracker } from '@/lib/useIssTracker';

// Not its own modal — this renders as a tab's content inside
// ISSFeedModal's existing modal chrome (backdrop, header, close button),
// alongside the live video feed tab. Kept as its own file/component since
// it owns real, nontrivial state (useIssTracker), not because it needs a
// second modal wrapper.
export default function IssModal() {
  const { telemetry, isLoading, error, refetchTle } = useIssTracker();

  if (isLoading) {
    return <div className="p-6 font-mono text-xs text-neutral-500">Fetching ISS orbital elements…</div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <p className="font-mono text-xs text-rose-400">{error}</p>
        <button
          onClick={() => refetchTle()}
          className="px-3 py-1.5 text-xs font-mono uppercase rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Live Telemetry</span>
        <span
          className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-full ${
            telemetry?.isVisible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {telemetry?.isVisible ? 'Above Horizon' : 'Below Horizon'}
        </span>
      </div>

      {telemetry && (
        <div className="space-y-3 font-mono text-sm">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/60">
            <span className="text-neutral-500">Azimuth</span>
            <span className="font-semibold text-neutral-100">{telemetry.azimuth}°</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/60">
            <span className="text-neutral-500">Elevation</span>
            <span className="font-semibold text-neutral-100">{telemetry.elevation}°</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <div className="p-2 rounded bg-neutral-800/40">
              <div className="text-[10px] text-neutral-600">Sub-Sat Lat</div>
              <div className="text-neutral-200">{telemetry.latitude}°</div>
            </div>
            <div className="p-2 rounded bg-neutral-800/40">
              <div className="text-[10px] text-neutral-600">Sub-Sat Lon</div>
              <div className="text-neutral-200">{telemetry.longitude}°</div>
            </div>
            <div className="p-2 rounded bg-neutral-800/40">
              <div className="text-[10px] text-neutral-600">Altitude</div>
              <div className="text-neutral-200">{telemetry.altitudeKm} km</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] text-neutral-600">
            <span>Local SGP4 propagation from CelesTrak TLE</span>
            <span>Updated {telemetry.timestamp.toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
