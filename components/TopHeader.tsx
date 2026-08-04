'use client';

import React, { useState } from 'react';
import SearchMaster from './SearchMaster';
import ISSFeedModal from './ISSFeedModal';
import FactCheckerModal from './FactCheckerModal'; // Or inline trigger modal

export default function TopHeader() {
  const [isIssOpen, setIsIssOpen] = useState(false);
  const [isFactCheckerOpen, setIsFactCheckerOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b bg-neutral-950 border-neutral-800">
        {/* Left Side: LIVE ISS */}
        <button
          onClick={() => setIsIssOpen(true)}
          className="flex items-center px-3 py-1 space-x-2 font-mono text-xs transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-red-500/40 hover:border-red-500 text-neutral-200"
        >
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span>LIVE ISS</span>
        </button>

        {/* Right Side: Fact Checker + SearchBar + Auth Controls */}
        <div className="flex items-center space-x-2">
          {/* Fact Checker Button placed right next to Search */}
          <button
            onClick={() => setIsFactCheckerOpen(true)}
            className="flex items-center space-x-1.5 bg-neutral-900 border border-amber-500/40 hover:border-amber-500 px-2.5 py-1 rounded text-xs text-amber-400 font-mono transition-all cursor-pointer"
            title="Verify storyline / Fact Check"
          >
            <span>💡</span>
            <span className="hidden sm:inline">FACT CHECK</span>
          </button>

          {/* Search Bar */}
          <SearchMaster />

          <button className="px-3 py-1 ml-1 text-xs border rounded bg-neutral-900 border-neutral-700 hover:border-amber-500 text-neutral-300">
            Log In
          </button>
          <button className="px-3 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-neutral-950">
            Share
          </button>
        </div>
      </header>

      {/* ISS Stream Modal */}
      <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />

      {/* Fact Checker Modal / Popup */}
      {isFactCheckerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl p-6 border rounded-lg shadow-2xl bg-neutral-900 border-neutral-800">
            <button
              onClick={() => setIsFactCheckerOpen(false)}
              className="absolute font-mono text-sm top-4 right-4 text-neutral-400 hover:text-neutral-100"
            >
              ✕
            </button>
            
            <h2 className="mb-2 font-mono text-lg tracking-wider text-center text-amber-400">
              COSMIC FACT CHECKER
            </h2>
            <p className="mb-4 text-xs text-center text-neutral-400">
              Cross-referencing historical epochs, astronomical datasets, and natural frequency harmonics.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a cosmic question or query ingested archives..."
                className="flex-1 px-3 py-2 text-xs border rounded bg-neutral-950 border-neutral-800 text-neutral-200 focus:outline-none focus:border-amber-500"
              />
              <button className="px-4 py-2 font-mono text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-neutral-950">
                VERIFY
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}