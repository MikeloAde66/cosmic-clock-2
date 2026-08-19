'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import NoaaWidget from './NoaaWidget';
import AiOneChat from './AiOneChat';
import AncientGlyphRain from './AncientGlyphRain';
import { useRadioPlayer } from './radio/RadioPlayerContext';
import { RADIO_STATIONS } from '@/lib/radioStations';
import { GLOBE_NODES, type GlobeMarker } from '@/lib/globeMarkers';
import { useGeolocation } from '@/lib/useGeolocation';
import type { VaultDrawer, VaultProduct } from '@/lib/vaultRegistry';


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

// Deterministic PRNG (same approach StarTrackerView uses for its own,
// unrelated star field — kept local rather than shared, since it's an
// 8-line pure function and the two views have no other dependency on
// each other).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CASCADE_STAR_COUNT = 26;
const randomCascade = mulberry32(19700101);
// Slow/medium/fast duration tiers per star — gives the radial field a sense
// of depth (nearer stars rush past faster) instead of every star expanding
// outward at the same uniform rate.
const CASCADE_SPEED_TIERS = [
  { min: 14, max: 20 }, // slow
  { min: 8, max: 13 }, // medium
  { min: 3.5, max: 7 }, // fast
];
const CASCADE_STARS = Array.from({ length: CASCADE_STAR_COUNT }, () => {
  const tier = CASCADE_SPEED_TIERS[Math.floor(randomCascade() * CASCADE_SPEED_TIERS.length)];
  return {
    angle: `${(randomCascade() * 360).toFixed(2)}deg`,
    size: `${(1 + randomCascade() * 1.6).toFixed(2)}px`,
    delay: `${(randomCascade() * 16).toFixed(2)}s`,
    duration: `${(tier.min + randomCascade() * (tier.max - tier.min)).toFixed(2)}s`,
    opacity: (0.2 + randomCascade() * 0.5).toFixed(2),
  };
});

// Deep midnight purple/black → muted burnt sienna, interpolated by real
// wall-clock time. `phase` is where "now" falls within the current 12-hour
// block (0..1); running it through a sine wave (rather than a hard reset at
// the boundary) means the loop has no visible seam — it eases up to sienna
// at the midpoint of each 12h block and back down to midnight by the end.
const AMBIENT_FROM = { r: 12, g: 8, b: 28 };
const AMBIENT_TO = { r: 122, g: 58, b: 34 };
function getAmbientColor(date: Date): string {
  const CYCLE_MS = 12 * 60 * 60 * 1000;
  const phase = (date.getTime() % CYCLE_MS) / CYCLE_MS;
  const t = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  const r = Math.round(AMBIENT_FROM.r + (AMBIENT_TO.r - AMBIENT_FROM.r) * t);
  const g = Math.round(AMBIENT_FROM.g + (AMBIENT_TO.g - AMBIENT_FROM.g) * t);
  const b = Math.round(AMBIENT_FROM.b + (AMBIENT_TO.b - AMBIENT_FROM.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

type CosmicCanvasView = 'clock' | 'weather' | 'kali';

interface CosmicCanvasProps {
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
  // Lets AiOneHome collapse its own hero banner/sub-nav while the user is
  // inside a full-section sub-view (Weather/Kali) — those already have their
  // own BackButton, so the outer chrome above them was just dead space with
  // no matching space below, not a real second layer of navigation anyone used.
  onViewChange?: (view: CosmicCanvasView) => void;
  // Set by LeftNav's Weather/Kali Yuga icons (threaded through AiOneHome) —
  // replaces the pill buttons that used to float over the globe. A token
  // (not just the view name) so clicking the same icon twice in a row still
  // re-opens it even though this component stays mounted between clicks.
  requestedView?: { view: 'weather' | 'kali'; token: number } | null;
  // Bumped by LeftNav's Home icon (threaded through AiOneHome as
  // groundZeroToken) — Weather/Kali no longer have their own Back button,
  // so Home is the only way out of them, and needs to reset this
  // component's own view state directly.
  groundZeroToken?: number;
}

export default function CosmicCanvas({ onNavigateToVaultDrawer, onViewChange, requestedView, groundZeroToken }: CosmicCanvasProps) {
  const [activeView, setActiveView] = useState<CosmicCanvasView>('clock');

  useEffect(() => {
    onViewChange?.(activeView);
  }, [activeView, onViewChange]);

  useEffect(() => {
    if (requestedView) queueMicrotask(() => setActiveView(requestedView.view));
  }, [requestedView]);

  useEffect(() => {
    if (groundZeroToken) queueMicrotask(() => setActiveView('clock'));
  }, [groundZeroToken]);

  // Real-time 12-hour ambient color morph — recomputed on a slow interval
  // (not every render) since it only needs to *gradually* shift; the CSS
  // transition on the element using it smooths each step into a crossfade.
  const [ambientColor, setAmbientColor] = useState(() => getAmbientColor(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setAmbientColor(getAmbientColor(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const { station, playStation } = useRadioPlayer();
  const [previewMarker, setPreviewMarker] = useState<GlobeMarker | null>(null);
  const [drawerCount, setDrawerCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  // Real browser geolocation — drives both the magenta "you are here" globe
  // marker below and NoaaWidget's default coordinates once it's open,
  // rather than NoaaWidget always defaulting to a hardcoded Charleston, SC.
  const { coords: userCoords } = useGeolocation();
  const userMarkerPosition = userCoords ? projectMarker(userCoords.lat, userCoords.lon) : null;

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
    <div className="relative z-10 flex flex-col w-full h-full overflow-hidden">
      {/* Starfield now comes from the global <Starfield /> mounted in
          app/page.tsx, behind every tab — this used to render its own
          separate copy here, which would have doubled up with it. */}

      {activeView === 'clock' && (
        <>
          {/* Weather/Kali Yuga toggles now live in LeftNav's icon rail
              (Umbrella / pulsing Sparkles) instead of floating pill buttons
              here — see requestedView above for how a click there reaches
              this component. */}

          {/* Expanded center: live SVG/CSS Earth-axis animation */}
          <main className="relative flex items-center justify-center flex-1 p-6 overflow-hidden">
            {/* Real-time 12-hour ambient wash — deep midnight purple/black
                easing toward burnt sienna and back, tied to wall-clock time
                (see getAmbientColor). Scoped to this view only, so Star
                Tracker (a fully separate, opaque full-screen overlay
                mounted from TopHeader) is never touched by it. */}
            <div
              className="absolute inset-0 pointer-events-none transition-colors duration-[3000ms] ease-in-out"
              style={{
                background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${ambientColor} 0%, transparent 72%)`,
                opacity: 0.45,
              }}
            />

            {/* Soft galactic color hazes — slow independent drift, well
                under the Earth/marker layer. */}
            <div className="absolute w-[420px] h-[420px] -top-16 -left-20 rounded-full bg-gradient-to-br from-indigo-600/20 via-blue-500/10 to-transparent blur-3xl pointer-events-none animate-haze-drift-a" />
            <div className="absolute w-[380px] h-[380px] -bottom-20 -right-16 rounded-full bg-gradient-to-tl from-violet-600/15 via-blue-400/10 to-transparent blur-3xl pointer-events-none animate-haze-drift-b" />

            {/* Micro-cascading stars — radial "warp speed" expansion from
                center, distinct from the twinkling global <Starfield />
                behind every tab. */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {CASCADE_STARS.map((s, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 left-1/2 rounded-full bg-white animate-star-cascade"
                  style={{
                    width: s.size,
                    height: s.size,
                    animationDelay: s.delay,
                    animationDuration: s.duration,
                    ['--star-angle' as string]: s.angle,
                    ['--star-opacity' as string]: s.opacity,
                  } as React.CSSProperties}
                />
              ))}
            </div>

            {/* Slow, hypnotic Apple-style camera drift — the whole scene
                (Earth, markers, moon) breathes gently rather than sitting
                perfectly static. */}
            <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center animate-cinematic-drift">

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
                  {/* Southern pole blend — the source photo's Antarctic ice
                      renders as stark bright white; this tints it down into
                      the surrounding deep-navy ocean palette instead. The
                      image only pans horizontally (backgroundSize is
                      200% 100%), so the pole always sits at the same
                      vertical position regardless of animation phase — a
                      gradient anchored to the bottom of the disc stays
                      correctly aligned with it at every frame. */}
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_85%_38%_at_50%_100%,rgba(8,20,45,0.78)_0%,rgba(8,20,45,0.45)_45%,transparent_78%)]" />
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

                  {/* Real "you are here" marker — from the browser's actual
                      Geolocation API (see useGeolocation), projected with
                      the same orthographic math as every other globe
                      marker. Clicking it jumps straight to the Weather
                      view, now seeded with these same real coordinates
                      instead of NoaaWidget's Charleston, SC fallback. */}
                  {userMarkerPosition && (
                    <button
                      type="button"
                      title="Your location — live weather"
                      onClick={() => setActiveView('weather')}
                      className="absolute z-20 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer group"
                      style={{
                        left: `${userMarkerPosition.xPct}%`,
                        top: `${userMarkerPosition.yPct}%`,
                        width: `${14 * userMarkerPosition.scale}px`,
                        height: `${14 * userMarkerPosition.scale}px`,
                      }}
                    >
                      <span
                        className="relative w-2 h-2 rounded-full bg-fuchsia-500 animate-user-location-pulse transition-transform group-hover:scale-125"
                      />
                    </button>
                  )}
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

      {/* Weather — takes over the whole section (sized like the Kali Yuga
          view below, not the small floating widget it used to be), reuses
          the real NoaaWidget which now opens straight to the satellite feed
          instead of needing a second click to reveal it. */}
      {activeView === 'weather' && (
        <div className="relative z-30 flex flex-col w-full h-full p-4">
          <div className="relative flex-1 min-h-0 w-full overflow-y-auto rounded-lg border border-slate-800 bg-black/20 p-6 backdrop-blur-md">
            <div className="max-w-2xl mx-auto">
              <NoaaWidget initialCoords={userCoords} />
            </div>
          </div>
        </div>
      )}

      {/* Kali Yuga — takes over the whole section: epoch readout on top, Ai One chat filling the rest */}
      {activeView === 'kali' && (
        <div className="relative z-30 flex flex-col w-full h-full p-4">
          <div className="relative flex flex-col flex-1 min-h-0 w-full overflow-hidden rounded-lg border border-cyan-500/30 bg-black/20 p-4 shadow-[0_0_30px_rgba(0,240,255,0.1)] backdrop-blur-md">
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
        @keyframes userLocationPulse {
          0% { transform: scale(0.9); box-shadow: 0 0 6px #ff00ff; }
          100% { transform: scale(1.3); box-shadow: 0 0 16px #ff00ff, 0 0 24px #e000e0; }
        }
        .animate-user-location-pulse {
          animation: userLocationPulse 2s ease-in-out infinite alternate;
        }
        @keyframes cinematicDrift {
          0%, 100% { transform: scale(1) translate3d(0, 0, 0); }
          50% { transform: scale(1.035) translate3d(-0.6%, 0.4%, 0); }
        }
        .animate-cinematic-drift {
          animation: cinematicDrift 48s ease-in-out infinite;
        }
        @keyframes hazeDriftA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, 4%) scale(1.08); }
        }
        .animate-haze-drift-a {
          animation: hazeDriftA 60s ease-in-out infinite;
        }
        @keyframes hazeDriftB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4%, -3%) scale(1.06); }
        }
        .animate-haze-drift-b {
          animation: hazeDriftB 70s ease-in-out infinite;
        }
        @keyframes starCascade {
          0% {
            transform: translate(-50%, -50%) rotate(var(--star-angle)) translateX(0) scale(0.4);
            opacity: 0;
          }
          15% { opacity: var(--star-opacity, 0.5); }
          85% { opacity: var(--star-opacity, 0.5); }
          100% {
            transform: translate(-50%, -50%) rotate(var(--star-angle)) translateX(70vmax) scale(1.6);
            opacity: 0;
          }
        }
        .animate-star-cascade {
          animation-name: starCascade;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-fill-mode: backwards;
        }
      `}</style>
    </div>
  );
}
