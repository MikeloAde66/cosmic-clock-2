'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { CATEGORIES, RADIO_STATIONS, type RadioStation } from '@/lib/radioStations';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';

export default function RadioStreams() {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { station: playingStation, status, playStation, togglePlayPause } = useRadioPlayer();

  const handleTuneIn = (station: RadioStation) => {
    if (playingStation?.id === station.id) {
      togglePlayPause();
      return;
    }
    playStation(station);
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredStations = RADIO_STATIONS.filter((s) => {
    const matchesCategory = activeCategory === 'ALL' || s.category === activeCategory;
    const matchesSearch =
      !query || s.name.toLowerCase().includes(query) || s.tagline.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full h-full p-8 overflow-y-auto bg-[#0a0a0c]">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold tracking-widest text-white uppercase">
            Radio
          </h2>
          <div className="relative w-64">
            <Search className="absolute w-3.5 h-3.5 text-slate-500 left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter stations..."
              className="w-full py-1.5 pl-8 pr-3 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 outline-none focus:border-white/50 transition"
            />
          </div>
        </div>

        <div className="flex gap-2 pb-2 overflow-x-auto border-b border-slate-800">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-white/20 text-white border border-neutral-700'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredStations.map((station) => {
            const isActiveStation = playingStation?.id === station.id;
            const isPlaying = isActiveStation && status === 'playing';
            const isLoading = isActiveStation && status === 'loading';
            const isError = isActiveStation && status === 'error';

            return (
              <div
                key={station.id}
                className={`relative flex flex-col justify-between p-4 space-y-4 overflow-hidden transition-all border rounded-xl bg-slate-900/80 ${
                  isPlaying
                    ? 'border-neutral-700 '
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
                    {station.genre}
                  </span>

                  {isPlaying && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border rounded bg-white/20 text-white border-neutral-700">
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
                    onClick={() => handleTuneIn(station)}
                    className={`h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition ${
                      isPlaying
                        ? 'bg-white text-black border-neutral-700 font-bold hover:bg-neutral-200'
                        : 'bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {isPlaying ? '■ Pause' : isLoading ? '… Tuning' : '▶ Tune In'}
                  </button>

                  <div className="flex items-end h-3 gap-1">
                    <span className={`w-1 h-1 rounded-xs ${isPlaying ? 'bg-white/50 animate-pulse' : 'bg-slate-700'}`} />
                    <span className={`w-1 h-2 rounded-xs ${isPlaying ? 'bg-white/70 animate-pulse' : 'bg-slate-700'}`} style={{ animationDelay: '150ms' }} />
                    <span className={`w-1 h-3 rounded-xs ${isPlaying ? 'bg-white animate-pulse' : 'bg-slate-700'}`} style={{ animationDelay: '300ms' }} />
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
