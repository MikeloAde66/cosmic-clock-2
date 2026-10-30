'use client';

import React from 'react';
import { Play, SkipBack, SkipForward, Volume2, Music } from 'lucide-react';
import type { StudioOneHandoffTrack } from './PodsModule';
import RadioControlPanelPreview from './radio/RadioControlPanelPreview';

interface MediaFlowAudioCenterProps {
  // Kept so TenForwardSection/app/page.tsx keep compiling unchanged; the
  // shell below is inert and never calls it.
  onSendToStudioOne?: (track: StudioOneHandoffTrack) => void;
}

// Vacant placeholder for the next project. The layout and copy match the
// old Media Flow & Audio Center exactly, but nothing is wired up: every
// input/button is disabled and the whole body is inert (not focusable,
// not clickable). The previous working implementation lives, unreferenced,
// in ./MediaFlowAudioCenterLegacy.tsx for reuse (e.g. in Studio One).
export default function MediaFlowAudioCenter(_props: MediaFlowAudioCenterProps) {
  const card = 'border rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md';
  const input =
    'flex-1 min-w-0 px-3 py-2 text-sm bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none';
  const primaryBtn =
    'flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide rounded bg-cyan-500 text-black opacity-40';

  return (
    <div className="max-w-5xl mx-auto">
      <RadioControlPanelPreview />
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Media Flow &amp; Audio Center</h2>
        <p className="mt-1 text-sm text-slate-400">
          Your own audio library — pull tracks straight from Internet Archive, organize them, and play them back
          with a real waveform and an optional Webamp window.
        </p>
      </div>

      <div inert aria-disabled="true" className="pointer-events-none select-none cursor-default">
        <div className={`p-5 mb-4 space-y-2 ${card}`}>
          <span className="text-xs font-mono uppercase tracking-widest text-white/70">Load from Internet Archive</span>
          <div className="flex gap-2">
            <input
              disabled
              tabIndex={-1}
              placeholder="Item ID or URL — e.g. rosen or https://archive.org/details/rosen"
              className={input}
            />
            <button type="button" disabled tabIndex={-1} className={primaryBtn}>
              Load
            </button>
          </div>
        </div>

        <div className={`p-5 mb-4 space-y-2 ${card}`}>
          <span className="text-xs font-mono uppercase tracking-widest text-white/70">Load from RSS / Podcast Feed</span>
          <div className="flex gap-2">
            <input
              disabled
              tabIndex={-1}
              placeholder="Podcast RSS feed URL or a direct .mp3 link"
              className={input}
            />
            <button type="button" disabled tabIndex={-1} className={primaryBtn}>
              Add to Catalog
            </button>
          </div>
        </div>

        <div className={`p-5 space-y-4 ${card}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 border rounded-lg shrink-0 bg-cyan-500/10 border-cyan-500/30">
              <Music className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">Nothing loaded yet</p>
              <p className="text-xs truncate text-slate-500">Load an Internet Archive item above to begin</p>
            </div>
          </div>

          <div className="w-full overflow-hidden border rounded-xl border-cyan-500/20 bg-black/40" style={{ minHeight: 72 }} />
          <p className="text-[11px] text-slate-600">Waveform appears once a track is loaded.</p>

          <div className="flex items-center gap-3">
            <button type="button" disabled tabIndex={-1} aria-label="Previous track" className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 opacity-30">
              <SkipBack className="w-4 h-4" />
            </button>
            <button type="button" disabled tabIndex={-1} aria-label="Play" className="flex items-center justify-center w-10 h-10 border border-cyan-400 rounded-full bg-cyan-500/10 text-cyan-300 opacity-30">
              <Play className="w-4 h-4" />
            </button>
            <button type="button" disabled tabIndex={-1} aria-label="Next track" className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 opacity-30">
              <SkipForward className="w-4 h-4" />
            </button>
            <div className="flex items-center flex-1 min-w-0 gap-2">
              <Volume2 className="w-4 h-4 shrink-0 text-slate-500" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                defaultValue={0.8}
                disabled
                tabIndex={-1}
                className="w-full accent-cyan-400"
                aria-label="Volume"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-cyan-500/10">
            <button
              type="button"
              disabled
              tabIndex={-1}
              className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 opacity-60"
            >
              Launch Webamp
            </button>
          </div>
        </div>

        <div className={`p-5 mt-4 ${card}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-white/70">Your Catalog</span>
            <span className="text-[10px] font-mono text-slate-500">0/4 active</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Nothing imported yet — load an Internet Archive item above to start building your library.
          </p>
        </div>
      </div>
    </div>
  );
}
