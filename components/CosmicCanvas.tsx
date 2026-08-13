'use client';

import React, { useState } from 'react';
import { ArrowLeft, CloudSun, Compass, X } from 'lucide-react';
import NoaaWidget from './NoaaWidget';
import AiOneChat from './AiOneChat';
import AncientGlyphRain from './AncientGlyphRain';
import { useRadioPlayer } from './radio/RadioPlayerContext';
import { RADIO_STATIONS } from '@/lib/radioStations';
import { GLOBE_NODES, type GlobeMarker } from '@/lib/globeMarkers';
import type { VaultDrawer, VaultProduct } from '@/lib/vaultRegistry';

// Deterministic PRNG (mulberry32), not Math.random() — this component is
// server-rendered before hydration, and Math.random() would produce a
// different star field on the server than on the client, causing a
// hydration mismatch. A fixed seed makes both renders identical while
// still looking scattered/randomized.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Randomized starfield: sparse enough to stay in the background, dense
// enough to not read as bare. ~20% twinkle (via the shared keyframe below);
// the rest sit at a fixed size/opacity for depth without visual noise.
const STAR_COUNT = 135;
const randomStar = mulberry32(20260812);
const STARS = Array.from({ length: STAR_COUNT }, () => {
  const twinkles = randomStar() < 0.2;
  return {
    top: `${(randomStar() * 100).toFixed(2)}%`,
    left: `${(randomStar() * 100).toFixed(2)}%`,
    size: `${(1 + randomStar() * 1.5).toFixed(2)}px`,
    opacity: 0.15 + randomStar() * 0.7,
    twinkles,
    delay: `${(randomStar() * 4).toFixed(2)}s`,
    duration: `${(2.5 + randomStar() * 2.5).toFixed(2)}s`,
  };
});

// The globe is a flat CSS illusion (a Blue Marble background-image panned
// sideways behind a circular mask), not a real 3D projection — so there's
// no camera/sphere to hook marker placement into. This approximates one:
// a standard orthographic projection onto the visible disc, treating the
// viewer as always facing 0° longitude. Markers on the back hemisphere
// (cosC < 0) return null and aren't rendered; markers near the limb shrink
// via `scale` for a mild curvature illusion.
function projectMarker(lat: number, lng: number): { xPct: number; yPct: number; scale: number } | null {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const cosC = Math.cos(latRad) * Math.cos(lngRad);
  if (cosC < 0.05) return null;

  const x = Math.cos(latRad) * Math.sin(lngRad); // -1..1
  const y = -Math.sin(latRad); // -1..1, screen-up is negative

  return {
    xPct: 50 + x * 50,
    yPct: 50 + y * 50,
    scale: Math.max(0.55, cosC),
  };
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back
    </button>
  );
}

interface CosmicCanvasProps {
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
}

export default function CosmicCanvas({ onNavigateToVaultDrawer }: CosmicCanvasProps) {
  const [activeView, setActiveView] = useState<'clock' | 'weather' | 'kali'>('clock');
  const { station, playStation } = useRadioPlayer();
  const [previewMarker, setPreviewMarker] = useState<GlobeMarker | null>(null);
  const [drawerCount, setDrawerCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const handleMarkerClick = (marker: GlobeMarker) => {
    if (marker.type === 'radio') {
      const target = RADIO_STATIONS.find((s) => s.id === marker.stationId);
      if (target) playStation(target);
      return;
    }

    // Vault marker — show a small preview (title + file count) rather than
    // navigating immediately; "Open Drawer" inside it does the actual jump.
    setPreviewMarker(marker);
    setDrawerCount(null);
    if (!marker.drawer) return;
    setLoadingCount(true);
    fetch('/api/vault/list')
      .then((res) => res.json())
      .then((data: { products: VaultProduct[] }) => {
        const count = (data.products || [])
          .filter((p) => p.drawer === marker.drawer)
          .reduce((sum, p) => sum + (p.tracks?.length ?? 0), 0);
        setDrawerCount(count);
      })
      .catch((err) => console.error('Failed to load drawer file count:', err))
      .finally(() => setLoadingCount(false));
  };

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden bg-[#0a0a0c]">
      {/* Randomized starfield, behind everything else — only ~20% twinkle */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {STARS.map((star, idx) => (
          <div
            key={idx}
            className={`absolute rounded-full bg-white shadow-[0_0_4px_#ffffff] ${star.twinkles ? 'animate-twinkle' : ''}`}
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.twinkles ? undefined : star.opacity,
              animationDelay: star.twinkles ? star.delay : undefined,
              animationDuration: star.twinkles ? star.duration : undefined,
            }}
          />
        ))}
      </div>

      {activeView === 'clock' && (
        <>
          {/* Compact HUD toggle buttons — weather & epoch, each opens its own full section */}
          <div className="absolute z-30 flex items-center gap-2 top-4 left-4">
            <button
              onClick={() => setActiveView('weather')}
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
            >
              <CloudSun className="w-3.5 h-3.5" />
              Weather
            </button>

            <button
              onClick={() => setActiveView('kali')}
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
            >
              <Compass className="w-3.5 h-3.5" />
              Kali Yuga
            </button>
          </div>

          {/* Expanded center: live SVG/CSS Earth-axis animation */}
          <main className="relative flex items-center justify-center flex-1 p-6">
            <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">

              {/* Earth sphere mesh — 23.4° axial tilt kept as a real detail
                  of the globe itself, not part of the (now removed) HUD
                  vector overlay. */}
              <div className="absolute inset-0 flex items-center justify-center transform -rotate-[23.4deg]">
                {/* Rotating Earth: real NASA Blue Marble photo (public domain),
                    panned via a CSS animation (120s per revolution, linear,
                    infinite) — west-to-east. */}
                <div className="relative z-10 w-[62%] aspect-square rounded-full overflow-hidden shadow-[inset_0_0_35px_rgba(0,0,0,0.9),0_0_20px_rgba(255,255,255,0.15)]">
                  <div
                    className="absolute inset-0 animate-earth-spin"
                    style={{
                      backgroundImage: 'url(/earth/blue-marble.jpg)',
                      backgroundSize: '200% 100%',
                      backgroundRepeat: 'repeat-x',
                    }}
                  />
                  {/* Subtle spherical shading */}
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_35%_35%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
                  {/* Day/night terminator */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-black/35 to-black/85" />

                  {/* Station/Vault markers — orthographically projected onto
                      the disc (see projectMarker), nested here so the same
                      23.4° tilt transform applies to them automatically. */}
                  {GLOBE_NODES.map((marker) => {
                    const projected = projectMarker(marker.lat, marker.lng);
                    if (!projected) return null;
                    const isActiveStation = marker.type === 'radio' && station?.id === marker.stationId;
                    return (
                      <button
                        key={marker.id}
                        type="button"
                        title={marker.title}
                        onClick={() => handleMarkerClick(marker)}
                        className="absolute z-20 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer group"
                        style={{
                          left: `${projected.xPct}%`,
                          top: `${projected.yPct}%`,
                          width: `${14 * projected.scale}px`,
                          height: `${14 * projected.scale}px`,
                        }}
                      >
                        <span
                          className={`absolute inset-0 rounded-full ${isActiveStation ? 'animate-marker-pulse' : ''}`}
                          style={{ backgroundColor: marker.color, opacity: 0.35 }}
                        />
                        <span
                          className="relative w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor] transition-transform group-hover:scale-150"
                          style={{ backgroundColor: marker.color, color: marker.color }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vault marker preview — small anchored card, not a full
                  modal: a lightweight "what's in here" peek before the
                  explicit Open Drawer action actually navigates away. */}
              {previewMarker && previewMarker.type === 'vault' && (
                <div className="absolute z-40 w-56 p-3 space-y-2 border rounded-lg shadow-2xl bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/95 backdrop-blur-md border-neutral-700">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white">{previewMarker.title}</h4>
                    <button
                      onClick={() => setPreviewMarker(null)}
                      className="text-slate-500 hover:text-white shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">
                    {loadingCount ? 'Loading…' : `${drawerCount ?? 0} file${drawerCount === 1 ? '' : 's'} in this drawer`}
                  </p>
                  <button
                    onClick={() => {
                      if (previewMarker.drawer) onNavigateToVaultDrawer(previewMarker.drawer);
                      setPreviewMarker(null);
                    }}
                    className="w-full py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide rounded bg-white text-black hover:bg-neutral-200 transition"
                  >
                    Open Drawer →
                  </button>
                </div>
              )}

              {/* Crescent moon, fixed in the top-right corner of the canvas —
                  two overlapping circles: the outer one is the moon body,
                  the inner one is filled with the canvas's own background
                  color to "cut" the crescent shape out of it. */}
              <div className="absolute w-5 h-5 overflow-hidden rounded-full top-8 right-2 bg-gradient-to-br from-white via-slate-200 to-slate-400 shadow-[0_0_8px_rgba(255,255,255,0.35)]">
                <div className="absolute w-5 h-5 rounded-full bg-[#0a0a0c] -top-1 -right-2" />
              </div>
            </div>
          </main>
        </>
      )}

      {/* Weather — takes over the whole section, reuses the real NoaaWidget */}
      {activeView === 'weather' && (
        <div className="relative z-30 flex flex-col w-full h-full p-6">
          <div className="shrink-0 mb-4">
            <BackButton onClick={() => setActiveView('clock')} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-md mx-auto">
              <NoaaWidget />
            </div>
          </div>
        </div>
      )}

      {/* Kali Yuga — takes over the whole section: epoch readout on top, Ai One chat filling the rest */}
      {activeView === 'kali' && (
        <div className="relative z-30 flex flex-col w-full h-full p-6">
          <div className="shrink-0 mb-4">
            <BackButton onClick={() => setActiveView('clock')} />
          </div>

          <div className="relative flex flex-col flex-1 min-h-0 max-w-lg mx-auto w-full overflow-hidden rounded-lg border border-cyan-500/30 bg-black/20 p-4 shadow-[0_0_30px_rgba(0,240,255,0.1)] backdrop-blur-md">
            <AncientGlyphRain />

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              <div className="shrink-0">
                <span className="text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase">
                  Current Epoch
                </span>
                <h2 className="text-2xl font-bold tracking-wider text-white">KALI YUGA</h2>
                <p className="text-xs font-mono text-cyan-100 mt-1">YEAR 5,128 / 432,000</p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/40">
                  <div className="h-full w-[1.18%] bg-cyan-400" />
                </div>
                <span className="mt-1 block text-[9px] font-mono text-cyan-500/70">PROGRESS: 1.1870%</span>

                {/* The same orthographic projection this globe's own marker
                    system uses (see projectMarker above) — restated in
                    standard 3D spherical-to-Cartesian form rather than the
                    screen-space x/y + depth-check form projectMarker
                    actually computes in. */}
                <div className="mt-3 space-y-1 rounded border border-cyan-500/10 bg-black/40 p-3 font-mono text-[11px] text-cyan-400">
                  <div className="text-[10px] uppercase tracking-wider text-cyan-500/70">
                    Orthographic Projection Math
                  </div>
                  <div>x = R · cos(lat) · cos(lng)</div>
                  <div>y = R · sin(lat)</div>
                  <div>z = -R · cos(lat) · sin(lng)</div>
                </div>
              </div>

              <div className="flex-1 min-h-0 pt-3 mt-3 border-t border-cyan-500/20">
                <AiOneChat />
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.85; transform: scale(1.2); }
        }
        .animate-twinkle {
          animation-name: twinkle;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes earthSpin {
          from { background-position-x: 0%; }
          to { background-position-x: 100%; }
        }
        .animate-earth-spin {
          animation-name: earthSpin;
          animation-duration: 120s;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes markerPulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .animate-marker-pulse {
          animation: markerPulse 1.5s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
