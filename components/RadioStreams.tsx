'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, Pause, Play, Plus, Search, Upload, X } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  OUTKAST_COMING_SOON,
  OUTKAST_LINKS,
  RADIO_STATIONS,
  type RadioStation,
} from '@/lib/radioStations';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';
import { getAllStoredPlaylists, saveStoredPlaylist, type StoredPlaylist } from '@/lib/customPlaylistDB';
import { searchRadioBrowserStations, type DirectoryStation } from '@/lib/radioDirectories';
import type { LiveRadioStation } from '@/lib/radioStations';

interface CustomTrack {
  id: string;
  title: string;
  fileUrl: string;
  // Only set for uploaded files (needs URL.revokeObjectURL on cleanup) —
  // the pre-loaded demo track points at a real static asset instead.
  isBlobUrl?: boolean;
}

interface CustomPlaylist {
  id: string;
  name: string;
  tracks: CustomTrack[];
}

// One pre-loaded Vault Folder so first-time visitors see exactly how
// playback/track loading/folder views work before uploading anything of
// their own. Real audio file already in the project, not a placeholder.
const DEFAULT_PLAYLISTS: CustomPlaylist[] = [
  {
    id: 'demo-folder',
    name: 'Demo Beats',
    tracks: [{ id: 'demo-track-jlb', title: 'JLB Fusion', fileUrl: '/assets/jlb%20fusion.mp3' }],
  },
];

function VaultFolderCard({
  playlist,
  isExpanded,
  onToggle,
  onPlayTrack,
  activeTrackId,
  isPlaying,
}: {
  playlist: CustomPlaylist;
  isExpanded: boolean;
  onToggle: () => void;
  onPlayTrack: (track: CustomTrack) => void;
  activeTrackId?: string;
  isPlaying: boolean;
}) {
  const FolderIcon = isExpanded ? FolderOpen : Folder;
  return (
    <div className="relative mt-3">
      {/* Folder tab — the "high-tech Vault Folder" motif: a small notch
          above the card body, same silhouette as a physical file folder. */}
      <div className="absolute px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-b-0 rounded-t -top-2.5 left-3 bg-cyan-950/70 border-cyan-800/60 text-cyan-400">
        Vault Folder
      </div>
      <div className="overflow-hidden border rounded-lg rounded-tl-none border-cyan-900/50 bg-slate-950/80 shadow-[0_0_15px_rgba(0,240,255,0.05)]">
        <button
          onClick={onToggle}
          className="flex items-center justify-between w-full gap-2 px-3 py-2.5 text-left transition hover:bg-cyan-950/20"
        >
          <div className="flex items-center min-w-0 gap-2">
            <FolderIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-white truncate">{playlist.name}</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500 shrink-0">
            {playlist.tracks.length} track{playlist.tracks.length === 1 ? '' : 's'}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t border-cyan-900/40">
            {playlist.tracks.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[10px] text-slate-600">Empty — no tracks yet.</p>
            ) : (
              playlist.tracks.map((track) => {
                const isActive = activeTrackId === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => onPlayTrack(track)}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-mono transition border-t border-slate-800/60 first:border-t-0 ${
                      isActive ? 'bg-cyan-950/30 text-cyan-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {isActive && isPlaying ? (
                      <Pause className="w-3 h-3 shrink-0" />
                    ) : (
                      <Play className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">{track.title}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RadioStreams() {
  const [activeCategory, setActiveCategory] = useState<string>('ALL CHANNELS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBrowseMenu, setShowBrowseMenu] = useState<boolean>(false);
  const browseMenuRef = useRef<HTMLDivElement | null>(null);
  const { station: playingStation, status, playStation, togglePlayPause } = useRadioPlayer();

  // Program Manager-curated stations (see /api/admin/radio-stations) — a
  // separate, DB-backed layer that renders alongside the hand-picked
  // RADIO_STATIONS list below, not a replacement for it.
  const [adminStations, setAdminStations] = useState<LiveRadioStation[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/radio-stations')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.stations)) setAdminStations(data.stations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Live global search (Radio-Browser) — separate from the plain
  // client-side name/tagline filter on the curated RADIO_STATIONS list
  // below, which stays exactly as it worked before. Debounced so this
  // doesn't fire an API call on every keystroke, and only once the query
  // is long enough to return something meaningful.
  const [dynamicResults, setDynamicResults] = useState<DirectoryStation[]>([]);
  const [dynamicLoading, setDynamicLoading] = useState(false);
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setDynamicResults([]);
      setDynamicLoading(false);
      return;
    }
    let cancelled = false;
    setDynamicLoading(true);
    const timeout = setTimeout(async () => {
      const results = await searchRadioBrowserStations(trimmed);
      if (!cancelled) {
        setDynamicResults(results);
        setDynamicLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  // A live search result isn't a curated RadioStation — no badge/genre/
  // network of its own — so this synthesizes the minimum valid shape
  // playStation needs. /api/radio/queue's fallback path (see that route)
  // is what actually makes an id outside RADIO_STATIONS playable.
  const playDynamicResult = (result: DirectoryStation) => {
    const id = `rb-search-${result.id}`;
    if (playingStation?.id === id) {
      togglePlayPause();
      return;
    }
    const station: LiveRadioStation = {
      kind: 'live',
      id,
      name: result.name,
      network: 'Radio-Browser',
      tagline: result.tags || 'Live search result',
      genre: result.tags || '',
      category: 'ALL CHANNELS',
      streamUrl: result.streamUrl,
      badge: '●',
      badgeColor: '#3a3a3a',
    };
    playStation(station);
  };

  // Custom playlists — strictly client-side, no network calls anywhere in
  // this flow. React state drives the UI; user-created playlists (not the
  // shipped demo folder) are also persisted to IndexedDB via
  // lib/customPlaylistDB, which — unlike localStorage — can actually store
  // the uploaded audio bytes themselves, not just names/strings. Loaded
  // back and re-materialized into fresh blob URLs on mount below.
  const [customPlaylists, setCustomPlaylists] = useState<CustomPlaylist[]>(DEFAULT_PLAYLISTS);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>('demo-folder');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  // Title is independently editable per file, defaulting to its filename —
  // not just derived from the filename at creation time.
  const [pendingTracks, setPendingTracks] = useState<{ file: File; title: string }[]>([]);

  // Independent local player for custom tracks — a native <audio> element,
  // separate from the global radio queue (which is built from real station
  // configs, not ad-hoc client uploads). RadioPlayerContext's own
  // document-level 'play' listener already picks this up automatically and
  // pauses the global radio the instant it starts, with no extra wiring
  // needed here.
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeCustomTrack, setActiveCustomTrack] = useState<CustomTrack | null>(null);
  const [isCustomPlaying, setIsCustomPlaying] = useState(false);

  useEffect(() => {
    if (!showBrowseMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (browseMenuRef.current && !browseMenuRef.current.contains(e.target as Node)) {
        setShowBrowseMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBrowseMenu]);

  // Tracks every blob URL ever created (a ref, not customPlaylists state
  // itself, so the unmount cleanup below always sees playlists created
  // after mount too — a plain [] effect closing over customPlaylists would
  // only ever see its initial value) — revoked on unmount so they don't
  // leak memory once this view goes away.
  const blobUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Load any playlists persisted from a previous session — re-materializes
  // each stored Blob into a fresh object URL, since those don't survive a
  // reload even though the underlying bytes in IndexedDB do.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getAllStoredPlaylists();
      if (cancelled || stored.length === 0) return;
      const restored: CustomPlaylist[] = stored.map((pl) => ({
        id: pl.id,
        name: pl.name,
        tracks: pl.tracks.map((t) => {
          const fileUrl = URL.createObjectURL(t.blob);
          blobUrlsRef.current.add(fileUrl);
          return { id: t.id, title: t.title, fileUrl, isBlobUrl: true };
        }),
      }));
      setCustomPlaylists((prev) => [...prev, ...restored]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTuneIn = (station: RadioStation) => {
    if (playingStation?.id === station.id) {
      togglePlayPause();
      return;
    }
    playStation(station);
  };

  const playCustomTrack = (track: CustomTrack) => {
    if (activeCustomTrack?.id === track.id) {
      if (isCustomPlaying) customAudioRef.current?.pause();
      else customAudioRef.current?.play().catch(() => {});
      return;
    }
    setActiveCustomTrack(track);
  };

  useEffect(() => {
    if (!activeCustomTrack || !customAudioRef.current) return;
    customAudioRef.current.src = activeCustomTrack.fileUrl;
    customAudioRef.current.play().catch(() => {});
  }, [activeCustomTrack]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingTracks((prev) => [
      ...prev,
      ...files.map((file) => ({ file, title: file.name.replace(/\.[^/.]+$/, '') })),
    ]);
    e.target.value = '';
  };

  const removePendingTrack = (index: number) => {
    setPendingTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const renamePendingTrack = (index: number, title: string) => {
    setPendingTracks((prev) => prev.map((t, i) => (i === index ? { ...t, title } : t)));
  };

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;

    const trackIds = pendingTracks.map((_, i) => `${Date.now()}-${i}`);
    const tracks: CustomTrack[] = pendingTracks.map(({ file, title }, i) => {
      const fileUrl = URL.createObjectURL(file);
      blobUrlsRef.current.add(fileUrl);
      return {
        id: trackIds[i],
        title: title.trim() || file.name.replace(/\.[^/.]+$/, ''),
        fileUrl,
        isBlobUrl: true,
      };
    });
    const newPlaylist: CustomPlaylist = { id: `playlist-${Date.now()}`, name, tracks };
    setCustomPlaylists((prev) => [newPlaylist, ...prev]);
    setExpandedPlaylistId(newPlaylist.id);
    setNewPlaylistName('');
    setPendingTracks([]);
    setShowCreateModal(false);

    // Persist the raw File objects (Files are Blobs) so this playlist,
    // including its actual audio, survives a reload — not just its name.
    const stored: StoredPlaylist = {
      id: newPlaylist.id,
      name: newPlaylist.name,
      tracks: pendingTracks.map(({ file, title }, i) => ({
        id: trackIds[i],
        title: title.trim() || file.name.replace(/\.[^/.]+$/, ''),
        blob: file,
      })),
    };
    saveStoredPlaylist(stored);
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredStations = [...RADIO_STATIONS, ...adminStations].filter((s) => {
    const matchesCategory = activeCategory === 'ALL CHANNELS' || s.category === activeCategory;
    const matchesSearch =
      !query || s.name.toLowerCase().includes(query) || s.tagline.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="relative z-10 w-full h-full p-8 overflow-y-auto">
      <audio
        ref={customAudioRef}
        onPlay={() => setIsCustomPlaying(true)}
        onPause={() => setIsCustomPlaying(false)}
        onEnded={() => setIsCustomPlaying(false)}
      />
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold tracking-widest text-white uppercase">
            Radio Central
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
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}

          <div className="relative" ref={browseMenuRef}>
            <button
              onClick={() => setShowBrowseMenu((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition whitespace-nowrap border ${
                showBrowseMenu
                  ? 'bg-white/20 text-white border-neutral-700'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              BROWSE ▾
            </button>

            {showBrowseMenu && (
              <div className="absolute left-0 z-50 p-3 mt-2 border rounded-md shadow-lg w-96 bg-slate-900 border-neutral-700 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
                    Your Playlists
                  </span>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wide rounded bg-white text-black hover:bg-neutral-200 transition"
                  >
                    <Plus className="w-3 h-3" />
                    Add Playlist
                  </button>
                </div>

                {customPlaylists.map((pl) => (
                  <VaultFolderCard
                    key={pl.id}
                    playlist={pl}
                    isExpanded={expandedPlaylistId === pl.id}
                    onToggle={() => setExpandedPlaylistId((cur) => (cur === pl.id ? null : pl.id))}
                    onPlayTrack={playCustomTrack}
                    activeTrackId={activeCustomTrack?.id}
                    isPlaying={isCustomPlaying}
                  />
                ))}

                <div className="px-1 pt-3 pb-1 mt-4 text-[10px] font-mono tracking-wider uppercase border-t text-slate-500 border-slate-800">
                  Community
                </div>
                {OUTKAST_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-1 py-1.5 text-left text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}

                <div className="px-1 pt-2 pb-1 mt-1 text-[10px] font-mono tracking-wider uppercase border-t text-slate-500 border-slate-800">
                  Challenges
                </div>
                {OUTKAST_COMING_SOON.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between w-full px-1 py-1.5 text-[11px] font-mono text-slate-600"
                  >
                    <span>{entry.label}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-700">Soon</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">
                Live Search — Radio-Browser
              </span>
              {dynamicLoading && <span className="text-[10px] font-mono text-slate-600 animate-pulse">Searching…</span>}
            </div>
            {!dynamicLoading && dynamicResults.length === 0 && (
              <p className="text-xs font-mono text-slate-600">No live stations found for &quot;{searchQuery.trim()}&quot;.</p>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {dynamicResults.map((result) => {
                const dynamicId = `rb-search-${result.id}`;
                const isActiveStation = playingStation?.id === dynamicId;
                const isPlaying = isActiveStation && status === 'playing';
                const isLoadingStation = isActiveStation && status === 'loading';
                // Some third-party stations don't send CORS headers in a way
                // compatible with this app's single shared <audio
                // crossOrigin="anonymous"> element (needed for the spectrum
                // visualizer) — that fails as a real network error, not just
                // a flat visualizer. Surface it instead of silently
                // reverting to an unstyled "Tune In" with no explanation.
                const isErrorStation = isActiveStation && status === 'error';
                return (
                  <div
                    key={result.id}
                    className={`flex items-center justify-between gap-3 p-3 border rounded-lg bg-slate-900/40 ${
                      isPlaying ? 'border-neutral-700' : 'border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate text-slate-100">{result.name}</h4>
                      {result.tags && <p className="text-[10px] truncate text-slate-500">{result.tags}</p>}
                      {isErrorStation && (
                        <p className="text-[10px] font-mono text-red-400 mt-0.5">
                          Couldn&apos;t connect — this station may not support browser playback.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => playDynamicResult(result)}
                      className={`h-7 px-2.5 text-[10px] font-mono uppercase tracking-wide rounded border shrink-0 transition ${
                        isPlaying
                          ? 'bg-white text-black border-neutral-700 font-bold'
                          : isErrorStation
                            ? 'bg-red-950/60 border-red-900 text-red-400'
                            : 'bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {isPlaying ? '■ Pause' : isLoadingStation ? '… Tuning' : isErrorStation ? '⚠ Offline' : '▶ Tune In'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredStations.map((station) => {
            const isActiveStation = playingStation?.id === station.id;
            const isPlaying = isActiveStation && status === 'playing';
            const isLoading = isActiveStation && status === 'loading';
            const isError = isActiveStation && status === 'error';

            return (
              <div
                key={station.id}
                className={`relative flex flex-col justify-between p-4 space-y-4 overflow-hidden transition-all border rounded-xl bg-slate-900/45 backdrop-blur-[10px] ${
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

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-sm p-6 space-y-4 border shadow-2xl bg-slate-950 border-cyan-900/50 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">New Vault Folder</h3>
              <button onClick={() => setShowCreateModal(false)} aria-label="Close" className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name…"
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />

            <label className="flex items-center justify-center gap-2 w-full p-3 text-xs font-mono uppercase tracking-wide border border-dashed rounded-lg cursor-pointer border-slate-700 text-slate-400 hover:border-cyan-700 hover:text-cyan-300 transition">
              <Upload className="w-3.5 h-3.5" />
              Upload audio files
              <input type="file" accept="audio/*" multiple className="hidden" onChange={handleFileSelect} />
            </label>

            {pendingTracks.length > 0 && (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendingTracks.map((t, i) => (
                  <li
                    key={`${t.file.name}-${i}`}
                    className="flex items-center gap-2 px-2 py-1.5 border rounded border-slate-800 bg-slate-900/60"
                  >
                    <input
                      type="text"
                      value={t.title}
                      onChange={(e) => renamePendingTrack(i, e.target.value)}
                      placeholder="Track title…"
                      className="flex-1 min-w-0 text-[11px] font-mono bg-transparent text-slate-200 outline-none"
                    />
                    <button onClick={() => removePendingTrack(i)} className="text-slate-500 hover:text-rose-400 shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim()}
              className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Create Playlist
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
