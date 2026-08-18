'use client';

import React, { useState } from 'react';
import { ChevronDown, Pause, Play, Radio as RadioIcon, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import { useRadioPlayer } from './RadioPlayerContext';
import PlayerSpectrum from './PlayerSpectrum';
import { RADIO_STATIONS } from '@/lib/radioStations';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Mounted once at the app-shell level and always rendered above SiteFooter —
// on every tab, from initial page load. With no station picked yet it shows
// an idle/paused strip rather than nothing, so the bar itself is always
// visible; actual playback still only ever starts from an explicit Play
// press (playStation/togglePlayPause), never automatically.
export default function GlobalPlayerBar() {
  const { station, queue, currentIndex, status, currentTime, duration, volume, analyserRef, playStation, togglePlayPause, next, prev, seek, setVolume, stop } =
    useRadioPlayer();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="relative z-10 flex items-center gap-2 px-4 py-1.5 border-t shrink-0 bg-[#04060A] border-slate-800/80 text-slate-500 hover:text-white transition-colors"
        aria-label="Show radio player"
      >
        <RadioIcon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-mono uppercase tracking-wider">Radio</span>
      </button>
    );
  }

  if (!station) {
    return (
      <div className="relative z-10 flex items-center gap-4 px-4 py-2 border-t shrink-0 bg-[#04060A] border-slate-800/80">
        <div className="flex items-center min-w-0 gap-2">
          <RadioIcon className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-xs text-slate-500 truncate">Radio — press play to start streaming</p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => playStation(RADIO_STATIONS[0])}
          className="flex items-center justify-center w-8 h-8 text-black transition bg-white rounded-full hover:bg-neutral-200 shrink-0"
          aria-label="Play"
        >
          <Play className="w-4 h-4 ml-0.5" />
        </button>
        <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-white shrink-0" aria-label="Hide radio player">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const currentTrack = queue[currentIndex];
  const hasQueue = queue.length > 0;

  return (
    <div className="relative z-10 flex items-center gap-4 px-4 py-2 border-t shrink-0 bg-[#04060A] border-slate-800/80">
      <div className="flex items-center min-w-0 gap-2 w-40 sm:w-56">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{station.name}</p>
          <p className="text-[10px] text-slate-500 truncate font-mono flex items-center gap-1.5">
            {currentTrack?.isAd && (
              <span className="px-1 py-px text-[8px] font-bold uppercase tracking-wider text-white bg-red-600 rounded-sm shrink-0">
                AD
              </span>
            )}
            <span className="truncate">
              {currentTrack ? currentTrack.filename : station.kind === 'live' ? 'Live Stream' : ''}
            </span>
          </p>
        </div>
        <PlayerSpectrum analyserRef={analyserRef} isPlaying={status === 'playing'} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasQueue && (
          <button onClick={prev} className="text-slate-400 hover:text-white" aria-label="Previous track">
            <SkipBack className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={togglePlayPause}
          className="flex items-center justify-center w-8 h-8 text-black transition bg-white rounded-full hover:bg-neutral-200"
          aria-label={status === 'playing' ? 'Pause' : 'Play'}
        >
          {status === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        {hasQueue && (
          <button onClick={next} className="text-slate-400 hover:text-white" aria-label="Next track">
            <SkipForward className="w-4 h-4" />
          </button>
        )}
      </div>

      {hasQueue ? (
        <div className="flex items-center flex-1 min-w-0 gap-2 font-mono text-[10px] text-slate-500">
          <span className="shrink-0">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-white"
          />
          <span className="shrink-0">{formatTime(duration)}</span>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="items-center hidden w-24 gap-2 sm:flex shrink-0">
        <Volume2 className="w-3.5 h-3.5 text-slate-500" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full h-1 accent-white"
        />
      </div>

      {status === 'loading' && (
        <span className="font-mono text-[10px] text-slate-500 animate-pulse shrink-0">Loading…</span>
      )}
      {status === 'error' && <span className="font-mono text-[10px] text-rose-400 shrink-0">Error</span>}

      <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-white shrink-0" aria-label="Minimize radio player">
        <ChevronDown className="w-4 h-4" />
      </button>
      <button onClick={stop} className="text-slate-500 hover:text-white shrink-0" aria-label="Stop">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
