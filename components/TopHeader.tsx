'use client';

import React, { useState } from 'react';
import ISSFeedModal from './ISSFeedModal';
import LoginModal from './LoginModal';
import StarTrackerView from './StarTrackerView';

interface TopHeaderProps {
  activeTab?: string;
}

export default function TopHeader({ activeTab }: TopHeaderProps) {
  const [isIssOpen, setIsIssOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isStarTrackerOpen, setIsStarTrackerOpen] = useState(false);
  const isHome = activeTab === 'aione';

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b bg-neutral-950 border-neutral-800">
        {/* Left Side: LIVE ISS + Star Tracker */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsIssOpen(true)}
            className="flex items-center px-3 py-1 space-x-2 font-mono text-xs transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-red-500/40 hover:border-red-500 text-neutral-200"
          >
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span>LIVE ISS</span>
          </button>

          <button
            onClick={() => setIsStarTrackerOpen(true)}
            className="flex items-center px-3 py-1 space-x-2 font-mono text-xs transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-cyan-500/40 hover:border-cyan-400 text-neutral-200"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>STAR TRACKER</span>
          </button>
        </div>

        {/* Right Side: Auth Controls (search now lives on the Radio page only) */}
        <div className="flex items-center space-x-2">
          {isHome ? (
            <button
              onClick={() => setIsLoginOpen(true)}
              className="px-3 py-1 ml-1 text-xs border rounded bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-neutral-300"
            >
              Log In
            </button>
          ) : (
            <button className="px-3 py-1 text-xs font-semibold rounded bg-white hover:bg-neutral-200 text-neutral-950">
              Share
            </button>
          )}
          <button
            onClick={() => setIsLoginOpen(true)}
            title="Account Profile"
            className="flex items-center justify-center w-8 h-8 text-xs font-semibold text-white transition border rounded-full bg-neutral-800 border-neutral-700 hover:border-neutral-500"
          >
            CC
          </button>
        </div>
      </header>

      {/* ISS Stream Modal */}
      <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />

      {/* Log In Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Star Tracker — a dedicated full-screen view, not a stacked modal */}
      {isStarTrackerOpen && <StarTrackerView onBack={() => setIsStarTrackerOpen(false)} />}
    </>
  );
}
