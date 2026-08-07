'use client';

import React, { useState, useEffect } from 'react';
import { CloudSun, Compass } from 'lucide-react';
import NoaaWidget from './NoaaWidget';
import AiOneChat from './AiOneChat';

// Real Earth's actual rotation: 360° every 24 hours, computed from the true
// current time rather than an animation clock — so it always shows the
// correct face of the planet, even after the tab has been closed and
// reopened, and moves too slowly to perceive within a normal viewing
// session (as it should).
// Sparse, static star positions — a light scattering, not a dense field, so
// it never competes with the Earth for attention.
const STARS = [
  { top: '12%', left: '8%', size: '1px', delay: '0s', duration: '3s' },
  { top: '22%', left: '88%', size: '2px', delay: '1.2s', duration: '4s' },
  { top: '15%', left: '72%', size: '1px', delay: '0.5s', duration: '2.5s' },
  { top: '82%', left: '14%', size: '1px', delay: '2.1s', duration: '3.5s' },
  { top: '75%', left: '82%', size: '2px', delay: '0.8s', duration: '4.2s' },
  { top: '35%', left: '12%', size: '1.5px', delay: '1.7s', duration: '3.1s' },
  { top: '68%', left: '92%', size: '1px', delay: '2.4s', duration: '2.8s' },
  { top: '88%', left: '48%', size: '1px', delay: '0.3s', duration: '3.8s' },
  { top: '18%', left: '42%', size: '1.5px', delay: '1.9s', duration: '4.5s' },
  { top: '48%', left: '94%', size: '1px', delay: '1.1s', duration: '3.2s' },
  { top: '58%', left: '6%', size: '2px', delay: '2.7s', duration: '3.9s' },
  { top: '28%', left: '24%', size: '1px', delay: '0.4s', duration: '2.9s' },
  { top: '78%', left: '32%', size: '1px', delay: '1.6s', duration: '4.1s' },
  { top: '8%', left: '55%', size: '1.5px', delay: '2.2s', duration: '3.3s' },
  { top: '85%', left: '70%', size: '1px', delay: '0.9s', duration: '2.7s' },
  { top: '42%', left: '82%', size: '1px', delay: '1.5s', duration: '3.6s' },
];

function useRealTimeEarthRotation() {
  const [offsetPercent, setOffsetPercent] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
      setOffsetPercent((hours / 24) * 100);
    };
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, []);

  return offsetPercent;
}

export default function CosmicCanvas() {
  const [activeModal, setActiveModal] = useState<'weather' | 'kali' | null>(null);
  const earthOffsetPercent = useRealTimeEarthRotation();

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden bg-[#0a0a0c]">
      {/* Sparse twinkling starfield, behind everything else */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {STARS.map((star, idx) => (
          <div
            key={idx}
            className="absolute rounded-full bg-white animate-twinkle shadow-[0_0_4px_#ffffff]"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>

      {/* Compact HUD toggle buttons — weather & epoch, collapsed by default so the center stays open */}
      <div className="absolute z-30 flex items-center gap-2 top-4 left-4">
        <button
          onClick={() => setActiveModal(activeModal === 'weather' ? null : 'weather')}
          className={`flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition ${
            activeModal === 'weather'
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-slate-900/60 border-amber-500/30 text-amber-500/80 hover:border-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          <CloudSun className="w-3.5 h-3.5" />
          Weather
        </button>

        <button
          onClick={() => setActiveModal(activeModal === 'kali' ? null : 'kali')}
          className={`flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition ${
            activeModal === 'kali'
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-slate-900/60 border-amber-500/30 text-amber-500/80 hover:border-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Kali Yuga
        </button>
      </div>

      {/* Weather Popup — reuses the real NoaaWidget (address lookup included) */}
      {activeModal === 'weather' && (
        <div className="absolute z-40 w-80 top-14 left-4">
          <NoaaWidget />
        </div>
      )}

      {/* Kali Yuga Popup — epoch readout on top, Ai One chat below */}
      {activeModal === 'kali' && (
        <div className="absolute z-40 w-96 p-4 border rounded-lg shadow-2xl top-14 left-4 border-slate-800 bg-slate-950/95 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono tracking-widest text-amber-500/80 uppercase">
              Current Epoch
            </span>
            <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-200">✕</button>
          </div>
          <h2 className="text-2xl font-bold tracking-wider text-[#d4af37]">KALI YUGA</h2>
          <p className="text-xs font-mono text-[#e6ca65] mt-1">YEAR 5,128 / 432,000</p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#2a2a30]">
            <div className="h-full w-[1.18%] bg-[#d4af37]" />
          </div>
          <span className="mt-1 block text-[9px] font-mono text-slate-500">PROGRESS: 1.1870%</span>

          <div className="pt-3 mt-3 border-t border-slate-800">
            <AiOneChat />
          </div>
        </div>
      )}

      {/* Expanded center: live SVG/CSS Earth-axis animation */}
      <main className="relative flex items-center justify-center flex-1 p-6">
        <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">

          {/* Tilted Axial Assembly (23.4° Earth axis) */}
          <div className="absolute inset-0 flex items-center justify-center transform -rotate-[23.4deg]">
            {/* Precession Wobble Ring */}
            <div className="absolute top-[8%] w-[45%] h-[10%] border border-dashed rounded-full border-white/70 animate-[spin_26s_linear_infinite]" />

            {/* Earth Rotational Axis Vector */}
            <div className="absolute w-[1px] h-[96%] bg-gradient-to-b from-red-500 via-white/80 to-red-500 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />

            {/* Rotating Earth: real NASA Blue Marble photo (public domain),
                panned at the true 24-hour rotation rate computed from real
                time above — not a drawn approximation, not a fast decorative
                spin. */}
            <div className="relative z-10 w-[62%] aspect-square rounded-full overflow-hidden shadow-[inset_0_0_35px_rgba(0,0,0,0.9),0_0_20px_rgba(255,255,255,0.15)]">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'url(/earth/blue-marble.jpg)',
                  backgroundSize: '200% 100%',
                  backgroundRepeat: 'repeat-x',
                  backgroundPositionX: `${earthOffsetPercent}%`,
                }}
              />
              {/* Subtle spherical shading */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_35%_35%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
              {/* Day/night terminator */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-black/35 to-black/85" />
            </div>
          </div>

          {/* Counter-Rotating Outer Rings */}
          <div className="absolute inset-0 border border-dashed rounded-full border-white/20 animate-[spin_40s_linear_infinite]">
            <svg className="w-full h-full transform -rotate-45" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#ffffff" strokeWidth="0.3" strokeDasharray="10 80" strokeLinecap="round" />
            </svg>
          </div>

          <div className="absolute rounded-full inset-[8%] border border-white/10 animate-[spin_28s_linear_infinite_reverse]">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="15 65" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Sweeping horizon vector, anchored to the bottom of the canvas */}
        <div className="absolute inset-x-0 bottom-0 h-8 overflow-hidden pointer-events-none">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-900" />
          <div className="absolute top-1/2 -translate-y-1/2 h-[2px] w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent shadow-[0_0_6px_rgba(255,255,255,0.15)] animate-[sweepEast_9s_linear_infinite]" />
        </div>
      </main>

      <style jsx>{`
        @keyframes sweepEast {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.85; transform: scale(1.2); }
        }
        .animate-twinkle {
          animation-name: twinkle;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
