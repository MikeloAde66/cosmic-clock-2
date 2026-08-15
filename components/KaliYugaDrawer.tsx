"use client";

import React from "react";
import { CosmicData } from "@/lib/cosmicMath";

interface KaliYugaDrawerProps {
  cosmic: CosmicData | null;
  onOpenLore: () => void;
}

export default function KaliYugaDrawer({ cosmic, onOpenLore }: KaliYugaDrawerProps) {
  return (
    <div className="flex flex-col gap-3 p-4 border shadow-xl bg-slate-950/60 border-slate-800/80 rounded-2xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            Current Epoch
          </span>
        </div>
        <button
          onClick={onOpenLore}
          className="text-[9px] font-mono text-amber-400/80 hover:text-amber-300 tracking-wider uppercase border border-amber-500/30 px-2 py-0.5 rounded bg-amber-500/10 transition"
        >
          Explore Lore
        </button>
      </div>

      <div>
        <h2 className="font-mono text-lg font-bold tracking-wider uppercase text-amber-400">
          KALI YUGA
        </h2>
        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
          YEAR {cosmic?.kaliYugaYear ?? "5,128"} / 432,000
        </p>
      </div>

      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
        <div
          className="h-full transition-all duration-1000 rounded-full bg-amber-400"
          style={{ width: `${cosmic?.kaliYugaProgressPercent ?? '1.18'}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase">
        <span>Progress: {cosmic?.kaliYugaProgressPercent ?? "1.1870"}%</span>
        <span>Iron Age</span>
      </div>
    </div>
  );
}