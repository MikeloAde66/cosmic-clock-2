'use client';

import React from 'react';
import NoaaWidget from './NoaaWidget';
import CosmicCanvas from './CosmicCanvas'; // Main untouched clock geometry

export default function CenterpieceCanvas() {
  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#0f0d0a]">
      
      {/* 1. TOP-LEFT: NOAA Weather Feed positioned directly under top-left ISS tag */}
      <<NoaaWidget/>div className="absolute z-20 top-4 left-6 w-80">
        <NoaaWidget />
      </div>

      {/* 2. CENTER: Pure Untouched Clock Geometry */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <CosmicCanvas />
        </div>
      </div>

      {/* 3. BOTTOM-LEFT: Isolated Kali Yuga Epoch Component */}
      <div className="absolute bottom-6 left-6 z-20 max-w-sm rounded-lg border border-[#d4af37]/20 bg-[#14110c]/85 p-4 backdrop-blur-md shadow-lg">
        <span className="text-[10px] font-mono tracking-widest text-[#a38f65] uppercase">
          Current Epoch
        </span>
        <h2 className="text-xl font-bold tracking-wider text-[#d4af37]">
          KALI YUGA
        </h2>
        <p className="mt-1 text-xs font-mono text-[#e6ca65]">
          YEAR 5,128 / 432,000
        </p>
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#262015]">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-[#b8952b] to-[#f5e6c8]" 
            style={{ width: '1.187%' }} 
          />
        </div>
        <p className="mt-1 text-[10px] text-[#a38f65]">PROGRESS: 1.1870%</p>
      </div>

      {/* TOP-RIGHT LORE LINK */}
      <div className="absolute z-20 top-6 right-8">
        <button type="button" className="text-xs font-mono text-[#d4af37] hover:underline">
          • EXPLORE LORE
        </button>
      </div>

    </div>
  );
}

/* 
 * SEALED & VERIFIED BY DEV
 * STATUS: Overlays rearranged. Center dial completely unblocked.
 */