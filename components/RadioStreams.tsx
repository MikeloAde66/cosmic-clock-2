'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

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

interface TvShow {
  id: string;
  name: string;
  summary: string;
  genre: string;
  status: string;
  image: string | null;
  url: string;
  category: string;
}

// TVMaze (no API key required) fills categories where no free live audio
// stream exists — these are TV show cards, not radio stations, so they get
// their own card treatment (status + a real link to the show, no fake
// "Tune In" button that would have nothing to actually play).
const TVMAZE_QUERIES: { category: string; query: string }[] = [
  { category: 'COSMIC AMBIENT', query: 'space' },
  { category: 'FRINGE TV', query: 'paranormal' },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

const CATEGORIES = ['ALL', 'CURRENT AFFAIRS', 'COSMIC AMBIENT', 'FRINGE TV', 'GNOSTIC & ANCIENT', 'STOIC & WISDOM'];

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [tvShows, setTvShows] = useState<TvShow[]>([]);
  const [tvShowsLoading, setTvShowsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTvShows() {
      try {
        const results = await Promise.all(
          TVMAZE_QUERIES.map(async ({ category, query }) => {
            const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error(`TVMaze request failed: ${res.status}`);
            const data: { show: Record<string, unknown> }[] = await res.json();
            return data.slice(0, 6).map(({ show }): TvShow => ({
              id: String(show.id),
              name: String(show.name),
              summary: show.summary ? stripHtml(String(show.summary)) : 'No description available.',
              genre: Array.isArray(show.genres) && show.genres.length > 0 ? String(show.genres[0]) : 'TV',
              status: String(show.status ?? 'Unknown'),
              image: (show.image as { medium?: string } | null)?.medium ?? null,
              url: String(show.url ?? ''),
              category,
            }));
          })
        );
        if (!cancelled) setTvShows(results.flat());
      } catch (err) {
        console.error('TVMaze fetch failed:', err);
      } finally {
        if (!cancelled) setTvShowsLoading(false);
      }
    }

    fetchTvShows();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const query = searchQuery.trim().toLowerCase();

  const filteredStations = STATIONS.filter((s) => {
    const matchesCategory = activeCategory === 'ALL' || s.category === activeCategory;
    const matchesSearch =
      !query || s.name.toLowerCase().includes(query) || s.tagline.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const filteredTvShows = tvShows.filter((show) => {
    const matchesCategory = activeCategory === 'ALL' || show.category === activeCategory;
    const matchesSearch =
      !query || show.name.toLowerCase().includes(query) || show.summary.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const showTvLoadingCard =
    tvShowsLoading && (activeCategory === 'ALL' || TVMAZE_QUERIES.some((q) => q.category === activeCategory));

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
            const isComingSoon = !station.streamUrl;
            const isActiveStation = activeStationId === station.id;
            const isPlaying = isActiveStation && status === 'playing';
            const isLoading = isActiveStation && status === 'loading';
            const isError = isActiveStation && status === 'error';

            if (isComingSoon) {
              return (
                <div
                  key={station.id}
                  className="relative flex flex-col justify-between p-4 space-y-4 border border-dashed rounded-xl bg-slate-900/30 border-neutral-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-slate-600">
                      {station.genre}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded bg-white/5 text-white/70 border-neutral-700">
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
                    onClick={() => togglePlay(station)}
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

          {filteredTvShows.map((show) => {
            const isEnded = show.status.toLowerCase() === 'ended';
            return (
              <div
                key={show.id}
                className="relative flex flex-col justify-between p-4 space-y-4 overflow-hidden transition-all border rounded-xl bg-slate-900/80 border-slate-800 hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
                    {show.genre}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded ${
                      isEnded
                        ? 'bg-slate-800 text-slate-500 border-slate-700'
                        : 'bg-white/10 text-white border-neutral-700'
                    }`}
                  >
                    {show.status}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {show.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={show.image}
                      alt={show.name}
                      className="object-cover w-12 h-12 rounded shrink-0"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-12 h-12 text-xs font-mono font-black tracking-wider rounded shrink-0 bg-slate-800/60 text-slate-500">
                      TV
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate text-slate-100">{show.name}</h3>
                    <p className="text-xs truncate text-slate-400">{show.summary}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  {show.url ? (
                    <a
                      href={show.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 flex items-center text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
                    >
                      View Show ↗
                    </a>
                  ) : (
                    <span className="h-8 px-3 flex items-center text-[11px] font-mono uppercase tracking-wide text-slate-600">
                      No link available
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {showTvLoadingCard && (
            <div className="flex items-center justify-center p-4 border border-dashed h-36 rounded-xl border-neutral-700 bg-slate-900/30">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500 animate-pulse">
                Loading shows from TVMaze…
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
