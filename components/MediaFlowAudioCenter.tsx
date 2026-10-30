'use client';

import React from 'react';
import type { StudioOneHandoffTrack } from './PodsModule';

interface MediaFlowAudioCenterProps {
  // Kept so TenForwardSection/app/page.tsx keep compiling unchanged; this
  // slot is vacant and never calls it.
  onSendToStudioOne?: (track: StudioOneHandoffTrack) => void;
}

// Vacant workspace slot, reserved for the first agentic flow. Deliberately
// has no state, effects, network calls or media dependencies, and nothing
// in it is interactive — build the next feature by replacing this body.
export default function MediaFlowAudioCenter(_props: MediaFlowAudioCenterProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <div
        inert
        aria-disabled="true"
        className="flex flex-col items-center justify-center p-12 text-center border border-dashed pointer-events-none select-none rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md"
        style={{ minHeight: 320 }}
      >
        <span className="text-xs font-mono uppercase tracking-widest text-white/70">Reserved</span>
        <p className="mt-2 text-sm text-slate-500">This space is vacant.</p>
      </div>
    </div>
  );
}
