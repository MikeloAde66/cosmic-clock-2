'use client';

import React, { useMemo } from 'react';
import type { HoveredStarInfo } from './CelestialSphere';
import { findNearestConstellation, type ConstellationLineSegment, type RawConstellationNames } from '@/lib/starTrackerPro/constellationLines';

function formatRa(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
function formatDec(deg: number): string {
  const sign = deg < 0 ? '-' : '+';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}'`;
}

export default function ObjectTooltip({
  info,
  constellationSegments,
  constellationNames,
}: {
  info: HoveredStarInfo | null;
  constellationSegments: ConstellationLineSegment[] | null;
  constellationNames: RawConstellationNames | null;
}) {
  // Real distance-based nearest-figure lookup (see constellationLines.ts)
  // — recomputed only when the hovered star actually changes, not on
  // every pointer-move pixel jitter within the same star.
  const nearestConstellation = useMemo(() => {
    if (!info || !constellationSegments || !constellationNames) return null;
    return findNearestConstellation(info.star.raHours, info.star.decDeg, constellationSegments, constellationNames);
  }, [info, constellationSegments, constellationNames]);

  if (!info) return null;
  const { star, clientX, clientY } = info;

  return (
    <div
      className="fixed z-30 px-3 py-2 space-y-1 text-xs border rounded-lg shadow-xl pointer-events-none font-mono border-cyan-500/30 bg-slate-950/90 backdrop-blur-md text-slate-200"
      style={{ left: clientX + 14, top: clientY + 14, minWidth: 180 }}
    >
      <div className="font-bold text-cyan-300">Catalog Entry #{star.catalogIndex}</div>
      {nearestConstellation && (
        <div className="text-slate-400">
          Nearest constellation: <span className="text-slate-200">{nearestConstellation.name}</span>{' '}
          <span className="text-[10px] text-slate-500">(~{nearestConstellation.distanceDeg.toFixed(1)}° away)</span>
        </div>
      )}
      <div className="text-slate-400">
        RA/Dec: <span className="text-slate-200">{formatRa(star.raHours)}</span> /{' '}
        <span className="text-slate-200">{formatDec(star.decDeg)}</span>
      </div>
      <div className="text-slate-400">
        Alt/Az: <span className="text-slate-200">{star.altitudeDeg.toFixed(1)}°</span> /{' '}
        <span className="text-slate-200">{star.azimuthDeg.toFixed(1)}°</span>
      </div>
      <div className="text-slate-400">
        Magnitude: <span className="text-slate-200">{star.magnitude.toFixed(2)}</span>
      </div>
    </div>
  );
}
