'use client';

import React, { useState } from 'react';
import ISSFeedModal from './ISSFeedModal';

interface TopHeaderProps {
  checkedItems?: Set<string>;
  handleDownload?: () => void;
}

export default function TopHeader({
  checkedItems = new Set(),
  handleDownload,
}: TopHeaderProps) {
  const [isIssOpen, setIsIssOpen] = useState(false);

  return (
    <>
      <header className="flex h-16 w-full items-center justify-between border-b border-[#2a2a30] bg-[#0a0a0c]/90 px-6 backdrop-blur-md">
        
        {/* 1. TOP-LEFT: LIVE ISS FEED TRIGGER (Replaces Q-Rator Title/Logo) */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsIssOpen(true)}
            className="flex items-center gap-2 rounded border border-[#d4af37]/40 bg-[#16161a] px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-[#d4af37] transition-all duration-200 hover:border-[#d4af37] hover:bg-[#d4af37]/10 hover:shadow-[0_0_12px_rgba(212,175,55,0.2)]"
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full bg-red-400 rounded-full opacity-75 animate-ping"></span>
              <span className="relative inline-flex w-2 h-2 bg-red-500 rounded-full"></span>
            </span>
            LIVE ISS
          </button>
        </div>

        {/* 2. TOP-RIGHT: SEARCH & ACTIONS */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search masters..."
              className="w-full rounded border border-[#2a2a30] bg-[#121215] px-3 py-1.5 text-xs font-mono text-[#e0e0e0] placeholder-[#666] focus:border-[#d4af37] focus:outline-none"
            />
          </div>

          {/* Conditional Action / Download Button */}
          {(checkedItems?.size ?? 0) > 0 && handleDownload && (
            <button
              onClick={handleDownload}
              className="rounded bg-[#d4af37] px-3 py-1.5 text-xs font-mono font-bold text-black transition-colors hover:bg-[#e6ca65]"
            >
              Download ({checkedItems.size})
            </button>
          )}

          <button className="rounded border border-[#2a2a30] bg-[#121215] px-3 py-1.5 text-xs font-mono text-[#d4af37] hover:border-[#d4af37]">
            Log In
          </button>
          
          <button className="rounded bg-[#d4af37] px-3 py-1.5 text-xs font-mono font-bold text-black hover:bg-[#e6ca65]">
            Share
          </button>
        </div>
      </header>

      {/* 3. ISS LIVE STREAM MODAL */}
      {isIssOpen && (
        <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />
      )}
    </>
  );
}