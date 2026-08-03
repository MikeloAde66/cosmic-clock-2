'use client';

import React from 'react';
import { TopHeader } from '@/components/TopHeader';
import LeftNav from '@/components/LeftNav';
import CosmicCanvas from '@/components/CosmicCanvas';
import NoaaWidget from '@/components/NoaaWidget';

export default function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0d0a]">
      {/* 1. LEFT NAVIGATION BAR */}
      <LeftNav />

      {/* 2. MAIN VIEW AREA */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* TOP HEADER */}
        <TopHeader />

        {/* MAIN CANVAS WORKSPACE */}
        <main className="relative flex-1 overflow-hidden bg-[#0f0d0a]">
          
          {/* NOAA GROUND TELEMETRY (Upper Left Under ISS Badge) */}
          <div className="absolute z-20 top-4 left-6 w-80">
            <NoaaWidget />
          </div>

          {/* COSMIC CLOCK CORE (Untouched Centerpiece Geometry) */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              <CosmicCanvas />
            </div>
          </div>

          {/* KALI YUGA COMPONENT (Anchored All The Way Bottom Left) */}
          <div className="absolute z-20 bottom-6 left-6">
            <div className="flex flex-col gap-1 rounded-lg border border-[#d4af37]/20 bg-[#14110c]/85 p-4 backdrop-blur-md shadow-lg">
              <span className="text-[10px] font-mono tracking-widest text-[#a38f65] uppercase">
                Current Epoch
              </span>
              <h2 className="text-xl font-bold tracking-wider text-[#d4af37]">
                KALI YUGA
              </h2>
              <p className="text-xs font-mono text-[#e6ca65]">
                YEAR 5,128 / 432,000
              </p>
              <div className="mt-2 h-1.5 w-56 rounded-full bg-[#262015]">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-[#b8952b] to-[#f5e6c8]" 
                  style={{ width: '1.187%' }} 
                />
              </div>
              <p className="mt-1 text-[10px] font-mono text-[#a38f65]">
                PROGRESS: 1.1870%
              </p>
            </div>
          </div>

          {/* EXPLORE LORE LINK (Upper Right) */}
          <div className="absolute z-20 top-6 right-8">
            <button type="button" className="text-xs font-mono text-[#d4af37] hover:underline">
              • EXPLORE LORE
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}

/* 
 * SEALED & VERIFIED BY DEV
 * STATUS: 
 * - TopHeader clean with Log In.
 * - Upper-left NOAA anchored.
 * - Bottom-left Kali Yuga anchored.
 * - Center clock dial untouched and clear of overlays.
 */