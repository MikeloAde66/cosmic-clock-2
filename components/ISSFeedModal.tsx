'use client';

import React from 'react';

interface ISSFeedModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}
export default function ISSFeedModal({ isOpen = false, onClose }: ISSFeedModalProps) {  // Instant Rule 1: If modal isn't open, do not render in the DOM
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl overflow-hidden border shadow-2xl bg-slate-900 border-slate-800 rounded-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <h3 className="font-mono text-xs font-bold tracking-wider uppercase text-amber-400">
              NASA LIVE ISS STREAM 4K
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="px-3 py-1 font-mono text-xs transition-all rounded cursor-pointer text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Video Frame */}
        <div className="relative w-full bg-black aspect-video">
          <iframe
            className="w-full h-full"
            src="https://www.youtube-nocookie.com/embed/j2F5qHid8UY?autoplay=1&mute=1"
            title="NASA Live ISS Stream"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}