"use client";

import React from "react";

export default function EpochDial({ progress = 1.1870 }: { progress?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="relative w-[340px] h-[340px] md:w-[460px] md:h-[460px] flex items-center justify-center">
        
        {/* Outer slow-spinning astrological ring */}
        <div 
          className="absolute inset-0 rounded-full border border-amber-500/20 animate-[spin_120s_linear_infinite]"
          style={{
            backgroundImage: `radial-gradient(circle, transparent 65%, rgba(251, 191, 36, 0.05) 100%)`,
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-full flex justify-center items-start pt-1"
              style={{ transform: `rotate(${i * 30}deg)` }}
            >
              <div className="w-0.5 h-3 bg-amber-500/40" />
            </div>
          ))}
        </div>

        {/* Counter-rotating dashed resonance ring */}
        <div className="absolute w-[82%] h-[82%] rounded-full border border-dashed border-amber-400/30 animate-[spin_90s_linear_infinite_reverse]" />

        {/* Active Epoch Progress Arc */}
        <svg className="absolute w-[70%] h-[70%] -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="42%"
            className="stroke-amber-950/40 fill-none"
            strokeWidth="4"
          />
          <circle
            cx="50%"
            cy="50%"
            r="42%"
            className="stroke-amber-400 fill-none transition-all duration-1000 ease-out"
            strokeWidth="4"
            strokeDasharray="264"
            strokeDashoffset={264 - (264 * (progress || 1)) / 100}
            strokeLinecap="round"
          />
        </svg>

        {/* Inner Pulsing Core */}
        <div className="absolute w-36 h-36 rounded-full bg-slate-950/80 border border-amber-500/40 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-[0_0_50px_rgba(251,191,36,0.15)] animate-pulse">
          <span className="text-[10px] tracking-widest text-amber-500 uppercase font-mono">
            CURRENT CYCLE
          </span>
          <span className="text-xl font-bold text-amber-300 font-mono tracking-wider mt-1">
            432,000Y
          </span>
          <span className="text-[9px] text-amber-400/70 font-mono mt-0.5">
            KALI YUGA
          </span>
        </div>

      </div>
    </div>
  );
}
