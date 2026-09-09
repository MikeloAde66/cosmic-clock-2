'use client';

import React from 'react';

export interface TargetAlignmentProps {
  targetName: string | null; // Current celestial target name
  targetRa: string | null; // Target Right Ascension (e.g. "19h 50m 47s")
  targetDec: string | null; // Target Declination (e.g. "+08° 52' 06"")
  offAxisErrorArcsec: number | null; // Total angular separation error in arcseconds
  isAligned: boolean; // Target lock acquisition state
}

export const TargetAlignmentDiagnostics: React.FC<TargetAlignmentProps> = ({
  targetName,
  targetRa,
  targetDec,
  offAxisErrorArcsec,
  isAligned,
}) => {
  // Normalize separation error for visual offset ring (0 - 60 arcsec scale)
  const maxError = 60;
  const clampedError = offAxisErrorArcsec !== null ? Math.min(offAxisErrorArcsec, maxError) : maxError;
  const reticleOffset = (clampedError / maxError) * 35; // Map to pixel radius offset

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 font-mono text-cyan-400 mt-4 w-full">
      <div className="flex justify-between items-center text-xs tracking-wider text-slate-400 border-b border-slate-800 pb-2 mb-3">
        <span>TARGET ALIGNMENT DIAGNOSTICS</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
            isAligned
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
          }`}
        >
          {isAligned ? 'TARGET LOCKED' : 'ALIGNING'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* RETICLE VISUALIZER */}
        <div className="relative w-40 h-40 mx-auto flex items-center justify-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Outer Bounds Ring */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="1" />

            {/* Precision Tolerance Zone (Inner Target Ring) */}
            <circle
              cx="50"
              cy="50"
              r="10"
              fill="none"
              stroke={isAligned ? '#10b981' : '#f59e0b'}
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Fixed Center Crosshairs */}
            <line x1="50" y1="5" x2="50" y2="95" stroke="#334155" strokeWidth="0.8" />
            <line x1="5" y1="50" x2="95" y2="50" stroke="#334155" strokeWidth="0.8" />

            {/* Dynamic Target Point Vector */}
            {offAxisErrorArcsec !== null ? (
              <g>
                <circle
                  cx={50 + reticleOffset * 0.707}
                  cy={50 - reticleOffset * 0.707}
                  r="4"
                  fill="none"
                  stroke={isAligned ? '#34d399' : '#fbbf24'}
                  strokeWidth="1.5"
                />
                <circle
                  cx={50 + reticleOffset * 0.707}
                  cy={50 - reticleOffset * 0.707}
                  r="1.5"
                  fill={isAligned ? '#34d399' : '#fbbf24'}
                />
              </g>
            ) : null}
          </svg>

          {/* Scale Label */}
          <span className="absolute bottom-1 right-2 text-[9px] text-slate-500">60&quot; FOV</span>
        </div>

        {/* TELEMETRY READOUTS */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-800/60 pb-1">
            <span className="text-slate-400">TARGET:</span>
            <span className="text-slate-200 font-bold">{targetName ?? 'NO TARGET'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-800/60 pb-1">
            <span className="text-slate-400">TARGET RA:</span>
            <span className="text-cyan-300">{targetRa ?? '--h --m --s'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-800/60 pb-1">
            <span className="text-slate-400">TARGET DEC:</span>
            <span className="text-cyan-300">{targetDec ?? "--° --' --\""}</span>
          </div>

          <div className="flex justify-between border-b border-slate-800/60 pb-1">
            <span className="text-slate-400">ANGULAR ERROR:</span>
            <span className={offAxisErrorArcsec !== null && offAxisErrorArcsec < 10 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {offAxisErrorArcsec !== null ? `${offAxisErrorArcsec.toFixed(1)}"` : 'AWAITING DATA'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetAlignmentDiagnostics;
