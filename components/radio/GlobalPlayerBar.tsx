'use client';

import React from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import { useRadioPlayer } from './RadioPlayerContext';
import PlayerSpectrum from './PlayerSpectrum';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Mounted once at the app-shell level, always rendered (renders nothing
// until a station is selected) — this is what makes playback persist across
// tab switches instead of stopping when Radio unmounts.
export default function GlobalPlayerBar() {
  const { station, queue, currentIndex, status, currentTime, duration, volume, analyserRef, togglePlayPause, next, prev, seek, setVolume, stop } =
    useRadioPlayer();

  if (!station) return null;

  const currentTrack = queue[currentIndex];
  const hasQueue = queue.length > 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t shrink-0 bg-[#04060A] border-slate-800/80">
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

      <button onClick={stop} className="text-slate-500 hover:text-white shrink-0" aria-label="Stop">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
