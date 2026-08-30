'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import MediaFlowAudioCenter from './MediaFlowAudioCenter';

interface TenForwardSectionProps {
  // Only set when opened as its own dedicated view (via LeftNav's icon, or
  // the Gallery Grid's Digital Magazine card) — renders the fixed-overlay
  // + Back button chrome that StarTrackerView uses. Omitted when embedded
  // inline as a Continuous Stack section, where the page itself owns the
  // scroll.
  onBack?: () => void;
}

// This workspace slot previously held "Let's Chat" (a Supabase-backed
// community forum — composer, feed, comment threads). It's now the Media
// Flow & Audio Center instead; the forum's backend and UI code
// (app/api/community/*, lib/communityCategories.ts) are left in place but
// unreferenced here, the same way TrialGateModal was left orphaned earlier
// rather than deleted, in case the forum comes back later.
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
        <MediaFlowAudioCenter />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-16">
      <MediaFlowAudioCenter />
    </div>
  );
}
