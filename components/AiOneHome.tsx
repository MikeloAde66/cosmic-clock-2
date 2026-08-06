'use client';

import React from 'react';
import CosmicCanvas from './CosmicCanvas';

export default function AiOneHome() {
  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 flex flex-col font-sans">

      {/* HERO BANNER */}
      <div className="relative w-full h-80 bg-[#060a12] overflow-hidden border-b border-slate-800/80 flex flex-col items-center justify-center shrink-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/20 via-indigo-500/30 to-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/70" />

        <div className="relative z-10 px-4 space-y-2 text-center">
          <h1 className="text-5xl md:text-6xl font-black tracking-wider text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">
            AI ONE
          </h1>
          <p className="font-mono text-xs tracking-widest uppercase md:text-sm text-slate-300">
            Cosmic Creation & Broadcast Hub
          </p>
        </div>
      </div>

      {/* SUB-NAV: lightweight inline menu text, not pill buttons */}
      <div className="flex items-center justify-center w-full py-3 space-x-8 text-xs font-mono tracking-widest uppercase border-b border-slate-800/80 bg-[#0b1326] shrink-0">
        <span
          className="cursor-default text-slate-600"
          title="Pods now lives in the left sidebar"
        >
          Pods
        </span>

        <span
          className="cursor-default text-amber-500/40 transition-all duration-300 hover:text-amber-300 hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          title="Cosmic Clock — coming soon"
        >
          Cosmic Clock
        </span>

        <span
          className="cursor-default text-slate-600"
          title="Cosmic Vault now lives in the left sidebar"
        >
          Cosmic Vault
        </span>
      </div>

      {/* MAIN CONTENT VIEW: Cosmic Clock centerpiece, replacing the old video monitor */}
      <div className="flex-1 w-full max-w-6xl px-6 py-10 mx-auto">
        <div className="w-full overflow-hidden border shadow-2xl bg-slate-950 border-slate-800 rounded-2xl">
          <div className="relative w-full aspect-video">
            <CosmicCanvas />
          </div>
        </div>
      </div>
    </div>
  );
}
