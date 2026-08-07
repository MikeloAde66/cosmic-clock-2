'use client';

import React, { useState } from 'react';
import { CloudSun, Compass } from 'lucide-react';
import NoaaWidget from './NoaaWidget';

export default function CosmicCanvas() {
  const [activeModal, setActiveModal] = useState<'weather' | 'kali' | null>(null);

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden bg-[#0a0a0c]">
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

      {/* Kali Yuga Popup */}
      {activeModal === 'kali' && (
        <div className="absolute z-40 max-w-sm p-4 border rounded-lg shadow-2xl top-14 left-4 border-slate-800 bg-slate-950/95 backdrop-blur-md">
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
        </div>
      )}

      {/* Expanded center: live SVG/CSS Earth-axis animation */}
      <main className="relative flex items-center justify-center flex-1 p-6">
        <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">

          {/* Tilted Axial Assembly (23.4° Earth axis) */}
          <div className="absolute inset-0 flex items-center justify-center transform -rotate-[23.4deg]">
            {/* Precession Wobble Ring */}
            <div className="absolute top-[8%] w-[45%] h-[10%] border border-dashed rounded-full border-amber-400/60 animate-[spin_26s_linear_infinite]" />

            {/* Earth Rotational Axis Vector */}
            <div className="absolute w-[1.5px] h-[96%] bg-gradient-to-b from-red-500 via-amber-400/80 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />

            {/* Earth Globe */}
            <div className="relative w-[62%] aspect-square rounded-full border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-950 to-black overflow-hidden shadow-[inset_0_0_35px_rgba(0,0,0,0.95),0_0_25px_rgba(245,158,11,0.2)] flex items-center justify-center">
              {/* Diurnal Earth Rotation */}
              <div className="absolute inset-0 opacity-50 animate-[earthSpin_24s_linear_infinite]">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <path d="M 0,25 Q 50,35 100,25" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 2" />
                  <path d="M 0,50 Q 50,68 100,50" fill="none" stroke="#f59e0b" strokeWidth="1" />
                  <path d="M 0,75 Q 50,85 100,75" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 2" />
                  <ellipse cx="50" cy="50" rx="20" ry="48" fill="none" stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="3 3" />
                </svg>
              </div>

              {/* Day/Night Shadow */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-black/40 to-black/90" />
            </div>
          </div>

          {/* Counter-Rotating Outer Rings */}
          <div className="absolute inset-0 border border-dashed rounded-full border-amber-500/20 animate-[spin_40s_linear_infinite]">
            <svg className="w-full h-full transform -rotate-45" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="15 105" strokeLinecap="round" />
            </svg>
          </div>

          <div className="absolute rounded-full inset-[8%] border border-slate-800 animate-[spin_28s_linear_infinite_reverse]">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="25 75" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Sweeping horizon vector, anchored to the bottom of the canvas */}
        <div className="absolute inset-x-0 bottom-0 h-8 overflow-hidden pointer-events-none">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-900" />
          <div className="absolute top-1/2 -translate-y-1/2 h-[2px] w-1/2 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_#ffffff] animate-[sweepEast_3s_linear_infinite]" />
        </div>
      </main>

      <style jsx>{`
        @keyframes sweepEast {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes earthSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
