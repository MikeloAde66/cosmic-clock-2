'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

export interface CommercialCaption {
  // PLACEHOLDER timings — no real commercial audio exists yet for any
  // product (see lib/commercialScripts.ts), so these are evenly spaced
  // guesses. Recalibrate against the real track's actual waveform once one
  // is recorded/generated; the caption engine itself (timeupdate-driven
  // active-line lookup) is real and needs no changes when that happens.
  start: number;
  end: number;
  text: string;
}

interface CommercialPlayerProps {
  title: string;
  // Undefined until a real recorded/generated commercial file exists —
  // rendered as an honest "audio coming soon" state instead of pointing at
  // a fake path. Swap in a real e.g. '/audio/builder-kit-commercial.mp3'
  // here once one exists; playback/caption/no-loop/manual-replay logic
  // below needs no other changes.
  audioSrc?: string;
  captions: CommercialCaption[];
}

export default function CommercialPlayer({ title, audioSrc, captions }: CommercialPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);

  // One-shot autoplay on mount — only ever fires once a real audioSrc
  // exists. Browsers can still block autoplay before any user interaction
  // with the page; that's fine, the manual Play button below always works.
  useEffect(() => {
    if (!audioSrc) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {});
  }, [audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      const active = captions.find((c) => t >= c.start && t < c.end);
      setActiveCaption(active?.text ?? null);
    };
    // No loop, no auto-restart — ends paused at 0:00, requires a manual
    // Play click to hear it again.
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      setActiveCaption(null);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [captions]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setEnded(false);
      audio.play();
      setPlaying(true);
    }
  }

  return (
    <div className="p-4 space-y-3 border rounded-lg border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">{title} — Commercial</span>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!audioSrc}
          aria-label={playing ? 'Pause commercial' : 'Play commercial'}
          className="flex items-center justify-center w-8 h-8 transition border rounded-full border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
      </div>

      {audioSrc ? (
        <audio ref={audioRef} src={audioSrc} preload="auto" />
      ) : (
        <p className="text-[11px] font-mono text-slate-500">
          Audio coming soon — caption engine is wired and ready for it.
        </p>
      )}

      <div className="min-h-[2.5rem] flex items-center justify-center px-2 text-center">
        <p className="text-sm text-slate-200">{activeCaption ?? (ended ? '' : '')}</p>
      </div>
    </div>
  );
}
