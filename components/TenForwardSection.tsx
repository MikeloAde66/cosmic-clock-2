'use client';

import React from 'react';
import { ArrowLeft, MessageSquare, Radio as StreamIcon } from 'lucide-react';

interface TenForwardSectionProps {
  // Only set when opened as its own dedicated view (via LeftNav's "Let's
  // Chat" icon) — renders the fixed-overlay + Back button chrome that
  // StarTrackerView uses. Omitted when embedded inline as a Continuous
  // Stack section, where the page itself owns the scroll.
  onBack?: () => void;
}

// Continuous Stack section / dedicated view — "Let's Chat" community hub
// (previously "Ten Forward"). Built as a real, honest UI shell only: no
// invented posts/authors/upvote counts, no fake "live" broadcast, no
// simulated activity ticker. There's no forum, streaming, or
// community-activity backend anywhere in this app yet, and presenting
// fabricated posts/engagement as real would mislead real site visitors —
// this is scaffolding, ready to wire up to real data later, not a mockup
// dressed as the genuine thing.
function TenForwardContent() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Let&apos;s Chat</h2>
        <p className="mt-1 text-sm text-slate-400">Community hub — discussions, live sessions, and activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Single unified feed — no category tabs/view toggles, per spec. */}
        <div className="p-5 border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl border-slate-800 text-slate-500">
            <MessageSquare className="w-6 h-6 mb-2" />
            <p className="text-sm">No threads yet.</p>
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
  );
}

export default function TenForwardSection({ onBack }: TenForwardSectionProps) {
  if (onBack) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col w-full h-full p-4 overflow-y-auto bg-[#050810] text-slate-100">
        <div className="relative z-10 flex items-center gap-2 mb-4 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
        <TenForwardContent />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-16">
      <TenForwardContent />
    </div>
  );
}
