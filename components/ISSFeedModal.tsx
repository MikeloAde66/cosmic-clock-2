'use client';

import React, { useState } from 'react';
import IssModal from './IssModal';

interface ISSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ISSFeedModal({ isOpen, onClose }: ISSModalProps) {
  const [tab, setTab] = useState<'video' | 'telemetry'>('video');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl overflow-hidden border rounded-lg shadow-2xl bg-neutral-900 border-neutral-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-neutral-950 border-neutral-800">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-mono text-xs tracking-wider uppercase text-neutral-200">
              Live ISS Earth Viewing Stream
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 font-mono text-sm cursor-pointer text-neutral-400 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b bg-neutral-950 border-neutral-800">
          {(['video', 'telemetry'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2 text-[10px] font-mono uppercase tracking-wide transition ${
                tab === t ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {t === 'video' ? 'Video Feed' : 'Live Telemetry'}
            </button>
          ))}
        </div>

        {tab === 'video' ? (
          <>
            {/* Video Container */}
            <div className="relative w-full bg-black aspect-video">
              <iframe
                className="absolute top-0 left-0 w-full h-full border-0"
                src="https://www.youtube.com/embed/awQzjn72bI0?autoplay=1&mute=1"
                title="Live ISS HD Video Feed"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Telemetry Footer */}
            <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-800 flex justify-between items-center text-[10px] font-mono text-neutral-400">
              <span>SOURCE: NASA HDEV / Live Feed</span>
              <span>ORBITAL SPEED: ~17,500 MPH</span>
            </div>
          </>
        ) : (
          <IssModal />
        )}
      </div>
    </div>
  );
}