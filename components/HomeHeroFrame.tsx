'use client';

import React from 'react';

// Phase 1 of the Home tab rebuild — a single centered glass frame matching
// Radio/Pods' card language (bg-slate-900/40 backdrop-blur-md border
// border-slate-800/80 rounded-2xl), holding an ambient CSS-only visual loop
// (no real video/YouTube content — ambient motion only) with a small status
// pill overlay matching the LIVE ISS/STAR TRACKER pills in the header.
// Phase 2 (grid cards below this) is explicitly out of scope for now.
export default function HomeHeroFrame() {
  return (
    <div className="relative w-full max-w-2xl overflow-hidden border shadow-2xl aspect-video rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
      {/* Ambient visual loop — slow drifting/pulsing color blobs, same
          technique as CosmicCanvas's own haze-drift blobs, just contained
          within this frame instead of the full canvas. */}
      <div className="absolute rounded-full w-72 h-72 -top-12 -left-12 bg-gradient-to-br from-indigo-500/30 via-blue-500/15 to-transparent blur-3xl animate-hero-frame-drift-a" />
      <div className="absolute rounded-full w-72 h-72 -bottom-12 -right-12 bg-gradient-to-tl from-violet-500/25 via-cyan-400/10 to-transparent blur-3xl animate-hero-frame-drift-b" />

      {/* Slow horizontal scan sweep — reads as "signal", not decoration for
          its own sake, echoing the broadcast-monitor language from Pods. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-hero-frame-scan" />
      </div>

      {/* Status pill — same visual language as the LIVE ISS/STAR TRACKER
          pills in TopHeader, not a repeat of the "Ai One" title above. */}
      <div className="absolute flex items-center gap-2 px-3 py-1 border rounded-full top-3 left-3 bg-neutral-900/80 border-cyan-500/40">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="font-mono text-[10px] tracking-widest uppercase text-neutral-200">Signal Active</span>
      </div>

      <style jsx>{`
        @keyframes heroFrameDriftA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(6%, 8%) scale(1.1); }
        }
        .animate-hero-frame-drift-a {
          animation: heroFrameDriftA 22s ease-in-out infinite;
        }
        @keyframes heroFrameDriftB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-6%, -6%) scale(1.12); }
        }
        .animate-hero-frame-drift-b {
          animation: heroFrameDriftB 26s ease-in-out infinite;
        }
        @keyframes heroFrameScan {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        .animate-hero-frame-scan {
          animation: heroFrameScan 6s linear infinite;
        }
      `}</style>
    </div>
  );
}
