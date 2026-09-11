'use client';

import React, { useEffect, useState } from 'react';
import { useGeolocation } from '@/lib/useGeolocation';
import { loadConstellationLines, type ConstellationLineSegment } from '@/lib/starTrackerPro/constellationLines';
import type { GeodeticLocation } from '@/lib/starTrackerPro/coordinates';
import StarTrackerProScene, { POSITION_TICK_MS } from './StarTrackerProScene';

// Equatorial default (0°, 0°) — used only while real GPS is pending/denied.
const FALLBACK_LOCATION: GeodeticLocation = { latitudeDeg: 0, longitudeDeg: 0, elevationMeters: 0 };

// The bare WebGL celestial sphere pinned behind a separate HUD (see
// app/(standalone)/star-tracker/page.tsx, which layers StarTrackerView on
// top of this) — no chrome of its own, since StarTrackerView already
// supplies the Back button/header/telemetry/toggles this route needs. Owns
// just enough state (real geolocation, a real clock tick, real
// constellation data) to feed StarTrackerProScene.
export default function StarTrackerProBackground() {
  const { coords } = useGeolocation();
  const location: GeodeticLocation = coords
    ? { latitudeDeg: coords.lat, longitudeDeg: coords.lon, elevationMeters: 0 }
    : FALLBACK_LOCATION;

  const [constellationSegments, setConstellationSegments] = useState<ConstellationLineSegment[] | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    loadConstellationLines()
      .then((segments) => {
        if (!cancelled) setConstellationSegments(segments);
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

  return (
    <div className="fixed inset-0 z-0 bg-black">
      <StarTrackerProScene location={location} now={now} constellationSegments={constellationSegments} showConstellations showGrid={false} />
    </div>
  );
}
