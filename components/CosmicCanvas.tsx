'use client';

import React, { useState } from 'react';
import { ArrowLeft, CloudSun, Compass } from 'lucide-react';
import NoaaWidget from './NoaaWidget';
import AiOneChat from './AiOneChat';

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

export default function CosmicCanvas() {
  const [activeView, setActiveView] = useState<'clock' | 'weather' | 'kali'>('clock');
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
                </div>
              </div>

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

          <div className="flex flex-col flex-1 min-h-0 max-w-lg mx-auto w-full border rounded-lg shadow-2xl p-4 border-slate-800 bg-slate-950/95 backdrop-blur-md">
            <div className="shrink-0">
              <span className="text-[10px] font-mono tracking-widest text-white/70 uppercase">
                Current Epoch
              </span>
              <h2 className="text-2xl font-bold tracking-wider text-[#ffffff]">KALI YUGA</h2>
              <p className="text-xs font-mono text-slate-100 mt-1">YEAR 5,128 / 432,000</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#2a2a30]">
                <div className="h-full w-[1.18%] bg-[#ffffff]" />
              </div>
              <span className="mt-1 block text-[9px] font-mono text-slate-500">PROGRESS: 1.1870%</span>
            </div>

            <div className="flex-1 min-h-0 pt-3 mt-3 border-t border-slate-800">
              <AiOneChat />
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
      `}</style>
    </div>
  );
}
