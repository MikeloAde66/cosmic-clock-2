'use client';

import React, { useEffect, useState } from 'react';
import NoaaWidget from './NoaaWidget';
import AiOneChat from './AiOneChat';
import HomeHeroFrame from './HomeHeroFrame';
import { useGeolocation } from '@/lib/useGeolocation';
import type { VaultDrawer } from '@/lib/vaultRegistry';

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

// 70 stars, sized 0.7-1.8px for a dense, crisp pinpoint field — density and
// glow untouched. Duration tiers slowed way down (~75-80% velocity cut from
// the prior 9-13s/5-8s/2-4s) for a gentle, subtle, ambient drift rather than
// a fast rush.
const CASCADE_STAR_COUNT = 70;
const randomCascade = mulberry32(19700101);
// Slow/medium/fast duration tiers per star — gives the radial field a sense
// of depth (nearer stars rush past faster) instead of every star expanding
// outward at the same uniform rate.
const CASCADE_SPEED_TIERS = [
  { min: 42, max: 60 }, // slow
  { min: 24, max: 38 }, // medium
  { min: 10, max: 18 }, // fast
];
const CASCADE_STARS = Array.from({ length: CASCADE_STAR_COUNT }, () => {
  const tier = CASCADE_SPEED_TIERS[Math.floor(randomCascade() * CASCADE_SPEED_TIERS.length)];
  return {
    angle: `${(randomCascade() * 360).toFixed(2)}deg`,
    size: `${(0.6 + randomCascade() * 2.2).toFixed(2)}px`,
    delay: `${(randomCascade() * 16).toFixed(2)}s`,
    duration: `${(tier.min + randomCascade() * (tier.max - tier.min)).toFixed(2)}s`,
    opacity: (0.5 + randomCascade() * 0.5).toFixed(2),
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
    // 'weather' intentionally excluded — the view is disabled (see the
    // always-mounted-but-hidden NoaaWidget below); the umbrella icon stays
    // in the sidebar but no longer switches to a weather sub-view.
    if (requestedView && requestedView.view !== 'weather') queueMicrotask(() => setActiveView(requestedView.view));
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
  // Real browser geolocation — still drives NoaaWidget's default coordinates
  // once it's open, rather than NoaaWidget always defaulting to a hardcoded
  // Charleston, SC.
  const { coords: userCoords } = useGeolocation();

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
                mounted from TopHeader) is never touched by it. Was 0.45 —
                dark enough to visibly flatten the shadow-slide background
                image within just this region, reading as a seam/dark band
                against the un-dimmed hero banner above. Now a light touch
                of mood color instead of an opaque-looking wash. */}
            <div
              className="absolute inset-0 pointer-events-none transition-colors duration-[3000ms] ease-in-out"
              style={{
                background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${ambientColor} 0%, transparent 72%)`,
                opacity: 0.12,
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
                  className="absolute top-1/2 left-1/2 rounded-full bg-white shadow-[0_0_6px_2px_#ffffff] animate-star-cascade"
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

            {/* Crescent moon, fixed in the top-right corner — two
                overlapping circles: the outer one is the moon body, the
                inner one is filled with the canvas's own background color
                to "cut" the crescent shape out of it. Was nested inside a
                480px centered "centerpiece" box left over from the removed
                Earth sphere — that box had no visual framing of its own,
                just an obsolete sizing constraint holding this one small
                element away from main's true edge; now a direct child of
                main, still breathing via the same cinematic-drift animation. */}
            <div className="absolute w-5 h-5 overflow-hidden rounded-full top-8 right-8 bg-gradient-to-br from-white via-slate-200 to-slate-400 shadow-[0_0_8px_rgba(255,255,255,0.35)] animate-cinematic-drift">
              <div className="absolute w-5 h-5 rounded-full bg-[#0a0a0c] -top-1 -right-2" />
            </div>

            {/* Home hero frame — Phase 1 of the Home tab rebuild. Needs real
                pointer events, unlike the decorative layers above, so it's
                the one non-pointer-events-none child here. */}
            <div className="relative z-10 flex justify-center w-full px-4">
              <HomeHeroFrame />
            </div>
          </main>
        </>
      )}

      {/* Weather view disabled — the umbrella icon stays in LeftNav but no
          longer opens this UI (see the requestedView effect above). Kept
          mounted here, just visually hidden, so NoaaWidget's own weather
          data-fetching keeps running in the background rather than being
          torn out — cheap to re-enable later, and nothing polls a UI that
          isn't there. */}
      <div className="hidden" aria-hidden="true">
        <NoaaWidget initialCoords={userCoords} />
      </div>

      {/* Kali — takes over the whole section: epoch readout on top, Ai One
          chat filling the rest. No bordered/backdrop-blurred card wrapping
          this anymore, and no matrix glyph-rain canvas either — the clean
          starfield/nebula background shows through directly, unobstructed.
          A subtle transparent-to-black gradient grounds the content
          instead — deepens toward the bottom near the input bar, not a
          solid/tinted glass panel like Pods'. */}
      {activeView === 'kali' && (
        // flex-1 min-h-0, not h-full — see the weather view above for why.
        <div className="relative z-30 flex flex-col flex-1 w-full min-h-0 p-4">
          <div className="absolute inset-0 z-[5] pointer-events-none bg-gradient-to-b from-transparent via-black/55 to-black/95" />

          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            <div className="shrink-0">
              <span className="text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase">
                Current Epoch
              </span>
              <h2 className="text-2xl font-bold tracking-wider text-white">KALI</h2>
              <p className="text-xs font-mono text-cyan-100 mt-1">YEAR 5,128 / 432,000</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/40">
                <div className="h-full w-[1.18%] bg-cyan-400" />
              </div>
              <span className="mt-1 block text-[9px] font-mono text-cyan-500/70">PROGRESS: 1.1870%</span>

              {/* Standard orthographic projection math, restated here in
                  3D spherical-to-Cartesian form as flavor text for the
                  Kali Yuga epoch readout. */}
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
      )}

      <style jsx>{`
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
          /* Was a steep ease-in cubic-bezier (slow start, aggressive rush
             at the end) — reverted to linear (constant, steady speed
             throughout) for a gentler, more ambient drift with no
             acceleration spike. */
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-fill-mode: backwards;
        }
      `}</style>
    </div>
  );
}
