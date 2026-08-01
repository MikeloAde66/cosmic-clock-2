"use client";

import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ISSFeedModal({ isOpen, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative flex flex-col w-full max-w-4xl overflow-hidden border rounded-lg shadow-2xl bg-slate-900 border-amber-500/30">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 font-mono text-xs border-b bg-slate-950 border-amber-500/20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-bold tracking-wider text-amber-300">LIVE ISS HD EARTH VIEW</span>
            <span className="text-[10px] text-slate-500">| NASA HDEV STREAM</span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs transition-all border rounded border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            ✕ CLOSE
          </button>
        </div>

<div className="relative w-full h-[360px] bg-black">
<iframe
  src="https://www.youtube-nocookie.com/embed/1CUqs1uAqpQ?autoplay=1&mute=1"
  title="Live ISS HD Earth Viewing Stream"
  className="w-full h-full scale-105 border-0 pointer-events-none"
  allow="autoplay; encrypted-media; picture-in-picture"
  allowFullScreen
  />
  <div className="absolute top-3 left-3 bg-red-950/80 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/40 flex items-center gap-1.5 font-mono">
    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
    LIVE ISS FEED
  </div>
</div>

        {/* Telemetry Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 border-t border-amber-500/20 font-mono text-[11px]">
          <div>
            <span className="text-slate-500 block text-[9px]">ORBITAL SPEED</span>
            <span className="font-bold text-amber-300">~27,600 KM/H</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">ALTITUDE</span>
            <span className="font-bold text-cyan-300">~408 KM ABOVE EARTH</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[9px]">ORBITAL PERIOD</span>
            <span className="font-bold text-amber-300">92.68 MINUTES</span>
          </div>
        </div>
      </div>
    </div>
  );
}