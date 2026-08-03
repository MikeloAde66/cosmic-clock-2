'use client';

import React from 'react';

interface TopHeaderProps {
  searchTerm?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TopHeader({ searchTerm, onSearchChange }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#d4af37]/20 bg-[#0f0d0a]/90 px-6 backdrop-blur-md">
      
      {/* 1. LEFT: LIVE ISS Badge Slot */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-9 w-24 items-center justify-center overflow-hidden rounded border border-[#d4af37]/30 bg-black/80 shadow-[0_0_10px_rgba(212,175,55,0.1)]">
          <span className="text-[10px] font-mono tracking-widest text-[#d4af37] animate-pulse">
            LIVE ISS
          </span>
        </div>
      </div>

      {/* 2. RIGHT: Search Bar & Actions */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm || ''}
            onChange={onSearchChange}
            placeholder="Search masters..."
            className="w-60 rounded-md border border-[#d4af37]/30 bg-[#1a1610] px-3 py-1.5 text-xs text-[#f5e6c8] placeholder-[#a38f65] transition-all focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
          />
        </div>

        {/* Action Button: Renamed 'Assets' -> 'Log In' */}
        <button 
          type="button"
          className="rounded-md border border-[#d4af37]/40 bg-[#1a1610] px-3.5 py-1.5 text-xs font-semibold text-[#f5e6c8] transition-colors hover:bg-[#d4af37]/20 hover:text-[#ffffff]"
        >
          Log In
        </button>

        <button 
          type="button"
          className="rounded-md bg-[#d4af37] px-3.5 py-1.5 text-xs font-semibold text-[#0f0d0a] transition-all hover:bg-[#b8952b] hover:shadow-[0_0_12px_rgba(212,175,55,0.4)]"
        >
          Share
        </button>
      </div>

    </header>
  );
}

/* 
 * SEALED & VERIFIED BY DEV
 * STATUS: TopHeader Architecture updated with Log In & ISS stream slot.
 */