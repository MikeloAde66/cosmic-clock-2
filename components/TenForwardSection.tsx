'use client';

import React, { useState } from 'react';
import { MessageSquare, Radio as StreamIcon } from 'lucide-react';

const CATEGORIES = ['Cosmic Lore', 'Hardware Mods', 'General Discussion'];

// Continuous Stack section — "Ten Forward" community hub. Built as a real,
// honest UI shell only: no invented posts/authors/upvote counts, no fake
// "live" broadcast, no simulated activity ticker. There's no forum,
// streaming, or community-activity backend anywhere in this app yet, and
// presenting fabricated posts/engagement as real would mislead real site
// visitors — this is scaffolding, ready to wire up to real data later, not
// a mockup dressed as the genuine thing.
export default function TenForwardSection() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);

  return (
    <div className="w-full px-4 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Ten Forward</h2>
          <p className="mt-1 text-sm text-slate-400">Community hub — discussions, live sessions, and activity.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          {/* Forum thread layout — real category switching, honest empty
              state instead of invented threads. */}
          <div className="p-5 border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition ${
                    activeCategory === cat
                      ? 'bg-white text-neutral-950'
                      : 'bg-slate-950/60 border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl border-slate-800 text-slate-500">
              <MessageSquare className="w-6 h-6 mb-2" />
              <p className="text-sm">No threads in {activeCategory} yet.</p>
              <p className="mt-1 text-xs text-slate-600">Be the first to start a discussion.</p>
            </div>
          </div>

          {/* Webinar screen + activity ticker — same idle-state convention
              GlobalPlayerBar already uses ("paused strip until a station is
              picked") rather than a simulated "live" indicator. */}
          <div className="flex flex-col gap-4">
            <div className="relative flex items-center justify-center overflow-hidden border rounded-2xl aspect-video border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
              <span className="absolute flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase rounded-full top-3 left-3 bg-neutral-900/80 border border-slate-700 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Offline
              </span>
              <div className="text-center text-slate-500">
                <StreamIcon className="w-6 h-6 mx-auto mb-2" />
                <p className="text-xs font-mono tracking-wide uppercase">No live broadcast</p>
              </div>
            </div>

            <div className="px-4 py-3 overflow-hidden border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
              <p className="text-xs font-mono text-center text-slate-500">
                Community activity will appear here once discussions go live.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
