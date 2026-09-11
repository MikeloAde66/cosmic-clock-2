'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Body } from 'astronomy-engine';
import { useGeolocation } from '@/lib/useGeolocation';
import {
  loadConstellationLines,
  loadConstellationNames,
  type ConstellationLineSegment,
  type RawConstellationNames,
} from '@/lib/starTrackerPro/constellationLines';
import { bodyToHorizon, type GeodeticLocation, type HorizonPosition } from '@/lib/starTrackerPro/coordinates';
import type { IdentifiedStar } from '@/lib/starTrackerPro/starCatalogBuffers';
import type { HoveredStarInfo } from './CelestialSphere';
import StarTrackerProScene, { POSITION_TICK_MS } from './StarTrackerProScene';
import ObjectTooltip from './ObjectTooltip';
import OverlayToolbar from './OverlayToolbar';
import DeviceHub from './DeviceHub';

// Equatorial default (0°, 0°) — used only while real GPS is pending/denied,
// and labeled as such in the UI rather than silently presented as the
// user's real location.
const FALLBACK_LOCATION: GeodeticLocation = { latitudeDeg: 0, longitudeDeg: 0, elevationMeters: 0 };

const SEARCHABLE_BODIES: Record<string, Body> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
};

export default function StarTrackerProCanvas({ onBack }: { onBack: () => void }) {
  const { status: geoStatus, coords } = useGeolocation();
  const location: GeodeticLocation = coords
    ? { latitudeDeg: coords.lat, longitudeDeg: coords.lon, elevationMeters: 0 }
    : FALLBACK_LOCATION;

  const [constellationSegments, setConstellationSegments] = useState<ConstellationLineSegment[] | null>(null);
  const [constellationNames, setConstellationNames] = useState<RawConstellationNames | null>(null);
  const [now, setNow] = useState(() => new Date());

  const [showConstellations, setShowConstellations] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<HoveredStarInfo | null>(null);
  const [selectedBody, setSelectedBody] = useState<{ name: string; horizon: HorizonPosition } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadConstellationLines(), loadConstellationNames()])
      .then(([segments, names]) => {
        if (!cancelled) {
          setConstellationSegments(segments);
          setConstellationNames(names);
        }
      })
      .catch((err) => console.error('Constellation data load failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), POSITION_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const geoLabel = useMemo(() => {
    if (coords) return `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`;
    if (geoStatus === 'pending') return 'Locating…';
    return '0.00°, 0.00° (fallback — location unavailable)';
  }, [coords, geoStatus]);

  const handleSelectStar = (star: IdentifiedStar) => {
    setSelectedBody(null);
    setHoveredStar({ star, clientX: window.innerWidth / 2, clientY: window.innerHeight - 160 });
  };

  const handleSearchSelect = (name: string) => {
    const body = SEARCHABLE_BODIES[name];
    if (body === undefined) return;
    setHoveredStar(null);
    setSelectedBody({ name, horizon: bodyToHorizon(body, location, now) });
  };

  return (
    // fixed inset-0 z-50 — the same "dedicated full-screen view, not a
    // stacked modal" pattern every sibling overlay in app/page.tsx uses
    // (TenForwardSection, ISSFeedModal). This was `relative w-full
    // h-screen` instead, which only ever looked right on the standalone
    // /star-tracker route (where this is the only thing on the page, so
    // normal document flow happens to fill the viewport); mounted here
    // alongside the hub's own GalleryGrid content, it rendered as an
    // inert block appended below the grid instead of covering it —
    // clicking the "Star Tracker PRO" card looked like nothing happened.
    <div className="fixed inset-0 z-50 w-full h-full overflow-hidden bg-black">
      <button
        type="button"
        onClick={onBack}
        className="fixed z-20 flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border top-4 left-4 bg-slate-900/70 border-slate-700 text-white/80 hover:border-slate-500 hover:text-white backdrop-blur-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="fixed z-20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded top-4 right-4 text-cyan-300/90 bg-slate-900/70 border border-slate-700 backdrop-blur-sm">
        {geoLabel}
      </div>

      <OverlayToolbar
        showConstellations={showConstellations}
        onToggleConstellations={() => setShowConstellations((v) => !v)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        onSearchSelect={handleSearchSelect}
      />

      {selectedBody && (
        <div className="fixed z-20 px-3 py-2 font-mono text-xs border rounded-lg shadow-lg bottom-6 left-1/2 -translate-x-1/2 border-cyan-500/30 bg-slate-950/90 backdrop-blur-md text-slate-200">
          <span className="font-bold text-cyan-300">{selectedBody.name}</span> — Alt {selectedBody.horizon.altitudeDeg.toFixed(1)}°, Az{' '}
          {selectedBody.horizon.azimuthDeg.toFixed(1)}°
        </div>
      )}

      <StarTrackerProScene
        location={location}
        now={now}
        constellationSegments={constellationSegments}
        showConstellations={showConstellations}
        showGrid={showGrid}
        onHoverStar={setHoveredStar}
        onSelectStar={handleSelectStar}
      />

      <ObjectTooltip info={hoveredStar} constellationSegments={constellationSegments} constellationNames={constellationNames} />

      <DeviceHub />
    </div>
  );
}
