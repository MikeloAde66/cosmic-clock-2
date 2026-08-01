"use client";

import React from "react";

interface CosmicConverterProps {
  onExploreLore?: () => void;
}

export default function CosmicConverter({ onExploreLore }: CosmicConverterProps) {
  return (
    <div className="w-full p-4 border rounded-xl border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-widest text-amber-500 uppercase font-mono">
          Current Epoch
        </span>
        <button
          type="button"
          onClick={onExploreLore}
          className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded transition-all cursor-pointer pointer-events-auto"
        >
          ● EXPLORE LORE
        </button>
      </div>
      <h2 className="text-xl font-bold tracking-wider text-amber-400">KALI YUGA</h2>
      <p className="mt-1 font-mono text-xs text-slate-400">YEAR 5,128 / 432,000</p>
      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
        <div className="bg-amber-400 h-full w-[1.187%]" />
      </div>
      <span className="text-[10px] font-mono text-slate-500 block mt-1">PROGRESS: 1.1870%</span>
    </div>
  );
}