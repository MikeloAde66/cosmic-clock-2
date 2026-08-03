'use client';

import React from 'react';

interface ISSFeedModalProps {
  onClose: () => void;
}

export default function ISSFeedModal({ onClose }: ISSFeedModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl p-4 space-y-3 overflow-hidden border shadow-2xl bg-slate-900 border-amber-500/50 rounded-2xl">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <h3 className="font-mono text-sm font-bold tracking-wider text-amber-400">
              NASA LIVE ISS STREAM 4K
            </h3>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 font-mono text-sm transition border rounded text-slate-400 hover:text-slate-100 bg-slate-800 border-slate-700"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Live Stream Iframe */}
        <div className="relative w-full overflow-hidden border aspect-video rounded-xl bg-slate-950 border-slate-800">
<iframe
  className="w-full h-full"
  src="https://www.youtube-nocookie.com/embed/j2F5qHid8UY?autoplay=1&mute=1"
  title="NASA Live ISS Stream"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
/>        </div>

      </div>
    </div>
  );
}