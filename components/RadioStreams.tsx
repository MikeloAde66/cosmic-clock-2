'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RadioStation {
  id: string;
  name: string;
  tagline: string;
  genre: string;
  streamUrl: string;
  badge: string;
  badgeColor: string;
}

const STATIONS: RadioStation[] = [
  {
    id: 'bbc-world',
    name: 'BBC World Service',
    tagline: 'Global News & Analysis',
    genre: 'News / Current Affairs',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    badge: 'BBC',
    badgeColor: '#bb1919',
  },
  {
    id: 'npr-news',
    name: 'NPR News',
    tagline: 'National Public Radio Live',
    genre: 'Public Radio / Talk',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
    badge: 'NPR',
    badgeColor: '#1b3668',
  },
];

type Status = 'idle' | 'loading' | 'playing' | 'error';

export default function RadioStreams() {
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (station: RadioStation) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (activeStationId === station.id && status === 'playing') {
      audio.pause();
      setStatus('idle');
      return;
    }

    setActiveStationId(station.id);
    setStatus('loading');
    audio.src = station.streamUrl;
    audio.play().catch(() => setStatus('error'));
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  return (
    <div className="w-full h-full p-8 overflow-y-auto bg-[#0a0a0c]">
      <audio
        ref={audioRef}
        onPlaying={() => setStatus('playing')}
        onWaiting={() => setStatus('loading')}
        onError={() => setStatus('error')}
        onPause={() => setStatus((s) => (s === 'error' ? s : 'idle'))}
      />

      <div className="max-w-5xl mx-auto space-y-4">
        <h2 className="text-sm font-mono font-bold tracking-widest text-amber-500 uppercase">
          Radio
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {STATIONS.map((station) => {
            const isActiveStation = activeStationId === station.id;
            const isPlaying = isActiveStation && status === 'playing';
            const isLoading = isActiveStation && status === 'loading';
            const isError = isActiveStation && status === 'error';

            return (
              <div
                key={station.id}
                className={`relative flex flex-col justify-between p-4 space-y-4 overflow-hidden transition-all border rounded-xl bg-slate-900/80 ${
                  isPlaying
                    ? 'border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
                    {station.genre}
                  </span>

                  {isPlaying && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border rounded bg-amber-500/20 text-amber-400 border-amber-500/30">
                      ● On Air
                    </span>
                  )}
                  {isLoading && (
                    <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded bg-slate-800 text-slate-400 border-slate-700 animate-pulse">
                      Connecting…
                    </span>
                  )}
                  {isError && (
                    <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded bg-red-950/60 text-red-400 border-red-900">
                      Offline
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-12 h-12 text-xs font-mono font-black tracking-wider text-white rounded shrink-0"
                    style={{ backgroundColor: station.badgeColor }}
                  >
                    {station.badge}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate text-slate-100">{station.name}</h3>
                    <p className="text-xs truncate text-slate-400">{station.tagline}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => togglePlay(station)}
                    className={`h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition ${
                      isPlaying
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold hover:bg-amber-400'
                        : 'bg-slate-900/60 border-amber-500/30 text-amber-500/80 hover:border-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    {isPlaying ? '■ Pause' : isLoading ? '… Tuning' : '▶ Tune In'}
                  </button>

                  <div className="flex items-end h-3 gap-1">
                    <span className={`w-1 h-1 rounded-xs ${isPlaying ? 'bg-amber-500/50 animate-pulse' : 'bg-slate-700'}`} />
                    <span className={`w-1 h-2 rounded-xs ${isPlaying ? 'bg-amber-500/70 animate-pulse' : 'bg-slate-700'}`} style={{ animationDelay: '150ms' }} />
                    <span className={`w-1 h-3 rounded-xs ${isPlaying ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`} style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
