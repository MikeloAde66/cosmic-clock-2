'use client';

import React, { useState } from 'react';
import SearchMaster from './SearchMaster';
import ISSFeedModal from './ISSFeedModal';
import LoginModal from './LoginModal';

export default function TopHeader() {
  const [isIssOpen, setIsIssOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

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

        {/* Right Side: SearchBar + Auth Controls */}
        <div className="flex items-center space-x-2">
          {/* Search Bar */}
          <SearchMaster />

          <button
            onClick={() => setIsLoginOpen(true)}
            className="px-3 py-1 ml-1 text-xs border rounded bg-neutral-900 border-neutral-700 hover:border-amber-500 text-neutral-300"
          >
            Log In
          </button>
          <button className="px-3 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-neutral-950">
            Share
          </button>
        </div>
      </header>

      {/* ISS Stream Modal */}
      <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />

      {/* Log In Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}
