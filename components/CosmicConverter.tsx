'use client';

import React from 'react';

interface CosmicConverterProps {
  onExploreLore?: () => void;
}

export default function CosmicConverter({ onExploreLore }: CosmicConverterProps) {
  return (
    <div className="w-full p-4 bg-transparent border-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-widest text-amber-500 uppercase">
          Current Epoch
        </span>
        <button
          type="button"
          onClick={onExploreLore}
          className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          EXPLORE LORE
        </button>
      </div>

      <h2 className="text-xl font-bold tracking-wider uppercase text-amber-400">
        Kali Yuga
      </h2>
      <p className="mt-1 font-mono text-xs text-slate-400">
        YEAR 5,128 / 432,000
      </p>

      {/* Progress Bar Container */}
      <div className="w-full bg-slate-800/50 h-1.5 rounded-full mt-3 overflow-hidden">
        <div 
          className="h-full transition-all duration-500 rounded-full bg-amber-400" 
          style={{ width: '1.1870%' }}
        />
      </div>

      <span className="text-[10px] font-mono text-slate-500 mt-1 block">
        PROGRESS: 1.1870%
      </span>
    </div>
  );
}