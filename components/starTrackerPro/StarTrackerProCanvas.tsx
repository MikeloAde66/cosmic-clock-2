'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowLeft } from 'lucide-react';
import { useGeolocation } from '@/lib/useGeolocation';
import { buildStarInstanceBuffers, loadRawStarCatalog, type RawStarEntry, type StarInstanceBuffers } from '@/lib/starTrackerPro/starCatalogBuffers';
import type { GeodeticLocation } from '@/lib/starTrackerPro/coordinates';
import CelestialSphere, { DOME_RADIUS } from './CelestialSphere';
import DeviceHub from './DeviceHub';

// Real position tick — sidereal drift is continuous but slow (~15°/hour);
// recomputing once a second is genuinely fine visually while keeping the
// Alt/Az math (and the instance-matrix rebuild it triggers) off the
// per-frame render path. See CelestialSphere's own comment for why that
// separation matters for real 60fps rendering.
const POSITION_TICK_MS = 1000;

// Equatorial default (0°, 0°) — used only while real GPS is pending/denied,
// and labeled as such in the UI rather than silently presented as the
// user's real location.
const FALLBACK_LOCATION: GeodeticLocation = { latitudeDeg: 0, longitudeDeg: 0, elevationMeters: 0 };

export default function StarTrackerProCanvas({ onBack }: { onBack: () => void }) {
  const { status: geoStatus, coords } = useGeolocation();
  const location: GeodeticLocation = coords
    ? { latitudeDeg: coords.lat, longitudeDeg: coords.lon, elevationMeters: 0 }
    : FALLBACK_LOCATION;

  const [catalog, setCatalog] = useState<RawStarEntry[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [buffers, setBuffers] = useState<StarInstanceBuffers | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRawStarCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err) => console.error('Star catalog load failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), POSITION_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!catalog) return;
    setBuffers(buildStarInstanceBuffers(catalog, location, now, DOME_RADIUS));
    // location is a fresh object every render (GeoCoords isn't memoized
    // upstream) — real lat/lon values are what matter for recomputation,
    // not the wrapper object's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, now, location.latitudeDeg, location.longitudeDeg]);

  const geoLabel = useMemo(() => {
    if (coords) return `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`;
    if (geoStatus === 'pending') return 'Locating…';
    return '0.00°, 0.00° (fallback — location unavailable)';
  }, [coords, geoStatus]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
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

      <Canvas camera={{ position: [0, 0, 0.1], fov: 75, near: 0.1, far: DOME_RADIUS * 2 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.2} />
        <CelestialSphere buffers={buffers} />
        {/* enableZoom/enablePan off — this is a look-around-from-inside-a-
            fixed-radius-dome control, not a free-fly camera; zooming or
            panning away from the observer's real position would break the
            Alt/Az projection's whole premise. */}
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.4} target={[0, 0, -1]} />
      </Canvas>

      <DeviceHub />
    </div>
  );
}
