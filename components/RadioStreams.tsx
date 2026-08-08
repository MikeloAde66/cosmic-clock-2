'use client';

import React, { useEffect, useRef, useState } from 'react';
import SearchMaster from './SearchMaster';

interface RadioStation {
  id: string;
  name: string;
  network: string;
  tagline: string;
  genre: string;
  category: string;
  streamUrl: string; // empty string = not yet available (renders as a "Coming Soon" placeholder)
  badge: string;
  badgeColor: string;
}

const CATEGORIES = ['ALL', 'CURRENT AFFAIRS', 'COSMIC AMBIENT', 'CONSCIOUSNESS & FRINGE', 'GNOSTIC & ANCIENT', 'STOIC & WISDOM'];

const STATIONS: RadioStation[] = [
  // Current Affairs — real, verified working streams
  {
    id: 'bbc-world',
    name: 'BBC World Service',
    network: 'BBC',
    tagline: 'Global News & Analysis',
    genre: 'News / Current Affairs',
    category: 'CURRENT AFFAIRS',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    badge: 'BBC',
    badgeColor: '#bb1919',
  },
  {
    id: 'npr-news',
    name: 'NPR News',
    network: 'NPR',
    tagline: 'National Public Radio Live',
    genre: 'Public Radio / Talk',
    category: 'CURRENT AFFAIRS',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
    badge: 'NPR',
    badgeColor: '#1b3668',
  },

  // Cosmic Ambient — real, verified working SomaFM streams
  {
    id: 'somafm-deep-space-one',
    name: 'Deep Space One',
    network: 'SomaFM',
    tagline: 'Deep ambient electronic & space music for inner and outer exploration',
    genre: 'Ambient / Space',
    category: 'COSMIC AMBIENT',
    streamUrl: 'https://ice2.somafm.com/deepspaceone-128-mp3',
    badge: 'DS1',
    badgeColor: '#3b1f6b',
  },
  {
    id: 'somafm-space-station',
    name: 'Space Station Soma',
    network: 'SomaFM',
    tagline: 'Tune in, turn on, space out — spaced-out ambient electronica',
    genre: 'Ambient / Space',
    category: 'COSMIC AMBIENT',
    streamUrl: 'https://ice2.somafm.com/spacestation-128-mp3',
    badge: 'SSS',
    badgeColor: '#1f4a6b',
  },
  {
    id: 'somafm-mission-control',
    name: 'Mission Control',
    network: 'SomaFM',
    tagline: 'Celebrating NASA and space explorers everywhere',
    genre: 'Ambient / Space',
    category: 'COSMIC AMBIENT',
    streamUrl: 'https://ice2.somafm.com/missioncontrol-128-mp3',
    badge: 'MC',
    badgeColor: '#6b1f2f',
  },

  // Consciousness & Fringe — no free public stream exists yet; honest placeholders
  {
    id: 'coast-to-coast',
    name: 'Coast to Coast AM',
    network: 'Premiere Networks',
    tagline: 'Late-night paranormal, consciousness & unexplained phenomena',
    genre: 'Talk / Late-Night',
    category: 'CONSCIOUSNESS & FRINGE',
    streamUrl: '',
    badge: 'C2C',
    badgeColor: '#3a3a3a',
  },

  // Gnostic & Ancient — honest placeholders (the real Aeon Byte content already lives in Pods)
  {
    id: 'aeon-byte-gnostic',
    name: 'Aeon Byte Radio',
    network: 'Gnostic Network',
    tagline: 'Heretical history, Nag Hammadi & cosmic myths — full episodes in Pods',
    genre: 'Talk / Gnostic',
    category: 'GNOSTIC & ANCIENT',
    streamUrl: '',
    badge: 'AB',
    badgeColor: '#3a3a3a',
  },
  {
    id: 'ancient-cosmology',
    name: 'Ancient Cosmology & Chronicles',
    network: 'Lore Vault',
    tagline: 'Precession, sacred geometry & lost civilizations',
    genre: 'Talk / Ancient History',
    category: 'GNOSTIC & ANCIENT',
    streamUrl: '',
    badge: 'ACC',
    badgeColor: '#3a3a3a',
  },

  // Stoic & Wisdom — honest placeholder
  {
    id: 'stoic-spectrum',
    name: 'The Stoic Spectrum',
    network: 'Mind & Virtue Radio',
    tagline: 'Marcus Aurelius, Epictetus & practical ancient philosophy',
    genre: 'Talk / Philosophy',
    category: 'STOIC & WISDOM',
    streamUrl: '',
    badge: 'STO',
    badgeColor: '#3a3a3a',
  },
];

type Status = 'idle' | 'loading' | 'playing' | 'error';

export default function RadioStreams() {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (station: RadioStation) => {
    const audio = audioRef.current;
    if (!audio || !station.streamUrl) return;

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

  const filteredStations = activeCategory === 'ALL'
    ? STATIONS
    : STATIONS.filter((s) => s.category === activeCategory);

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold tracking-widest text-amber-500 uppercase">
            Radio
          </h2>
          <SearchMaster />
        </div>

        <div className="flex gap-2 pb-2 overflow-x-auto border-b border-slate-800">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredStations.map((station) => {
            const isComingSoon = !station.streamUrl;
            const isActiveStation = activeStationId === station.id;
            const isPlaying = isActiveStation && status === 'playing';
            const isLoading = isActiveStation && status === 'loading';
            const isError = isActiveStation && status === 'error';

            if (isComingSoon) {
              return (
                <div
                  key={station.id}
                  className="relative flex flex-col justify-between p-4 space-y-4 border border-dashed rounded-xl bg-slate-900/30 border-amber-500/15"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-slate-600">
                      {station.genre}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded bg-amber-500/5 text-amber-500/40 border-amber-500/15">
                      Coming Soon
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 text-xs font-mono font-black tracking-wider rounded shrink-0 bg-slate-800/60 text-slate-500">
                      {station.badge}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate text-slate-400">{station.name}</h3>
                      <p className="text-xs truncate text-slate-600">{station.tagline}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                    <span className="h-8 px-3 flex items-center text-[11px] font-mono uppercase tracking-wide text-slate-600">
                      Reserved
                    </span>
                  </div>
                </div>
              );
            }

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
