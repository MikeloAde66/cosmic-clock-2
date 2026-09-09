'use client';

import React from 'react';

// Every field is real telescope telemetry (see lib/useTelescopeConnection.ts)
// or explicitly null when the real value genuinely isn't known yet — no
// prop defaults here on purpose. A default like `driftRate = 0.12` would
// silently render a fabricated number as if it were live hardware data the
// moment a caller forgets to pass one; requiring an explicit value (real or
// null) is what makes that impossible.
export interface TelemetryGaugesProps {
  alt: number | null; // Altitude in degrees (0-90), from real position
  az: number | null; // Azimuth in degrees (0-360), from real position
  driftRate: number | null; // arcsec/sec, measured between idle polls; null until 2 real samples exist
  isSlewing: boolean;
  slewProgress: number | null; // 0-100, derived from real angular separation; null until a target has been commanded
  targetDelta: number | null; // Degrees remaining to the last commanded target; null until one exists
  etaSeconds: number | null; // Only ever non-null for the simulator, whose slew timing is exactly known; real hardware doesn't report this
}

function Dash() {
  return <span className="text-slate-600">—</span>;
}

export const TelemetryGauges: React.FC<TelemetryGaugesProps> = ({
  alt,
  az,
  driftRate,
  isSlewing,
  slewProgress,
  targetDelta,
  etaSeconds,
}) => {
  const hasPosition = alt !== null && az !== null;
  const hasTarget = targetDelta !== null;

  const radius = 42;
  const altNormalized = hasPosition ? Math.max(0, Math.min(90, alt)) : 90;
  const needleLength = radius * (1 - altNormalized / 90);

  const clampedDrift = driftRate !== null ? Math.max(-5, Math.min(5, driftRate)) : 0;
  const driftPercent = ((clampedDrift + 5) / 10) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-cyan-400 font-mono">
      {/* 1. ALTITUDE / AZIMUTH RADIAL DIAL */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-between">
        <div className="w-full flex justify-between items-center text-xs tracking-wider text-slate-400 mb-2">
          <span>ALT / AZ POSITION</span>
          <span className="text-cyan-300 font-bold">
            {hasPosition ? `${alt.toFixed(1)}° / ${az.toFixed(1)}°` : <Dash />}
          </span>
        </div>

        <div className="relative w-36 h-36 flex items-center justify-center my-1">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="2" />
            <circle cx="50" cy="50" r={radius * 0.66} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="50" cy="50" r={radius * 0.33} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />

            <line x1="50" y1="8" x2="50" y2="12" stroke="#0ea5e9" strokeWidth="1.5" />
            <line x1="92" y1="50" x2="88" y2="50" stroke="#475569" strokeWidth="1" />
            <line x1="50" y1="92" x2="50" y2="88" stroke="#475569" strokeWidth="1" />
            <line x1="8" y1="50" x2="12" y2="50" stroke="#475569" strokeWidth="1" />

            {/* No real position yet -> no needle, rather than pointing
                somewhere arbitrary and implying that's where the mount is. */}
            {hasPosition && (
              <g transform={`rotate(${az}, 50, 50)`}>
                <line x1="50" y1="50" x2={50 + needleLength} y2="50" stroke="#22d3ee" strokeWidth="2" />
                <circle cx={50 + needleLength} cy="50" r="3" fill="#06b6d4" />
              </g>
            )}
            <circle cx="50" cy="50" r="2" fill="#38bdf8" />
          </svg>

          <span className="absolute top-0 text-[9px] text-cyan-500 font-bold">N</span>
          <span className="absolute right-0 text-[9px] text-slate-500">E</span>
          <span className="absolute bottom-0 text-[9px] text-slate-500">S</span>
          <span className="absolute left-0 text-[9px] text-slate-500">W</span>
        </div>

        <div className="w-full grid grid-cols-2 text-center text-[11px] pt-2 border-t border-slate-800 text-slate-400">
          <div>ALT: <span className="text-slate-200">{hasPosition ? `${alt.toFixed(1)}°` : <Dash />}</span></div>
          <div>AZ: <span className="text-slate-200">{hasPosition ? `${az.toFixed(1)}°` : <Dash />}</span></div>
        </div>
      </div>

      {/* 2. MOUNT DRIFT & PRECISION METER */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center text-xs tracking-wider text-slate-400">
          <span>TRACKING DRIFT</span>
          <span className={`font-bold ${driftRate !== null && Math.abs(driftRate) > 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {driftRate !== null ? `${driftRate > 0 ? '+' : ''}${driftRate.toFixed(2)} "/s` : <Dash />}
          </span>
        </div>

        <div className="my-auto py-2">
          <div className="relative w-full h-4 bg-slate-950 border border-slate-800 rounded overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-slate-600 z-10" />
            <div className="absolute top-0 bottom-0 left-[45%] right-[45%] bg-emerald-500/10 border-x border-emerald-500/30" />
            {/* No needle at all until a real drift measurement exists —
                sitting it at the center by default would read as "confirmed
                zero drift," which isn't true, it's just unmeasured. */}
            {driftRate !== null && (
              <div
                className={`absolute top-0 bottom-0 w-2 rounded-sm transition-all duration-300 z-20 ${
                  Math.abs(driftRate) > 0.5 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                }`}
                style={{ left: `calc(${driftPercent}% - 4px)` }}
              />
            )}
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>-5.0&quot;/s</span>
            <span>0.0</span>
            <span>+5.0&quot;/s</span>
          </div>
        </div>

        <div className="text-[11px] border-t border-slate-800 pt-2 flex justify-between text-slate-400">
          <span>PRECISION MODE:</span>
          <span className="text-cyan-400 font-semibold">{driftRate !== null ? 'SIDEREAL LOCK' : 'AWAITING DATA'}</span>
        </div>
      </div>

      {/* 3. SLEWING & TRANSITION PROGRESS */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center text-xs tracking-wider text-slate-400">
          <span>TARGET ACQUISITION</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
              isSlewing
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : hasTarget
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            {isSlewing ? 'SLEWING' : hasTarget ? 'ON TARGET' : 'NO TARGET'}
          </span>
        </div>

        <div className="my-auto py-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">REMAINING DELTA:</span>
            <span className="text-cyan-300 font-bold">
              {isSlewing && targetDelta !== null ? `${targetDelta.toFixed(2)}°` : hasTarget ? '0.00°' : <Dash />}
            </span>
          </div>

          <div className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
              style={{ width: `${isSlewing ? (slewProgress ?? 0) : hasTarget ? 100 : 0}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>START</span>
            <span>{isSlewing ? (etaSeconds !== null ? `ETA: ${Math.ceil(etaSeconds)}s` : 'ETA: —') : hasTarget ? 'READY' : ''}</span>
            <span>100%</span>
          </div>
        </div>

        <div className="text-[11px] border-t border-slate-800 pt-2 flex justify-between text-slate-400">
          <span>SYSTEM STATE:</span>
          <span className="text-slate-200">{isSlewing ? 'MOTOR DRIVE ACTIVE' : hasTarget ? 'TRACKING SYNCED' : 'IDLE'}</span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryGauges;
