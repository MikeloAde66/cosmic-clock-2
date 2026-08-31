'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Headphones, Play, Pause, Plus, Radio as RadioIcon, Search, Upload, Volume2, X } from 'lucide-react';
import { useRadioPlayer } from './RadioPlayerContext';
import PlayerSpectrum from './PlayerSpectrum';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, CATEGORY_LABELS, RADIO_STATIONS, type LiveRadioStation, type RadioStation } from '@/lib/radioStations';

// Station id the "Ai, Off Grid, and DIY" card (lib/radioStations.ts) is
// registered under — used to single out that one card for its dedicated
// Play icon below.
const OFF_GRID_STATION_ID = 'ai-off-grid-and-diy-ep1';

// Dedicated visual shell for Radio Central's cyberpunk-HUD restyle — a
// wrapper around the real player, not a fork of it. Every hook, id, and
// piece of state below is the exact same RadioPlayerContext/RADIO_STATIONS
// this app already uses elsewhere (RadioStreams.tsx, GlobalPlayerBar.tsx);
// nothing here duplicates or bypasses that engine.
//
// Deliberately excludes RadioStreams.tsx's custom-playlist (Vault Folder)
// uploads, the OUTKAST community menu, and live Radio-Browser search — the
// reference mockup's layout has no place for them. They're still real,
// still working features of the app, just not part of this particular view
// yet.
//
// Also deliberately drops several things the reference mockup showed as
// real telemetry but aren't: an "AI Program Director" with fake mood-
// detection/status claims, a scripted fake activity log, a fabricated
// "98% AI listener match" and "11,920 global listeners" count, dead
// AI Settings/Analytics buttons, and a Vault shortcut (the Vault's real
// security model is deliberate obscurity — a visible button here would
// undermine that). Every panel below shows only real, derivable data.

const TOKENS = {
  base: '#05080E',
  card: '#0B101D',
  subpanel: '#0e1626',
  cyan: '#00F2FE',
  crimson: '#FF2E63',
  emerald: '#00F5A0',
};

const glowBorder = `1px solid rgba(0,242,254,0.2)`;
const glowShadow = `0 0 15px rgba(0,242,254,0.15)`;
const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Purely decorative CSS-keyframe equalizer accent (log panel header) —
// distinct from the real AnalyserNode-driven bars elsewhere in this view
// (ON AIR NOW, the full-width visualizer), which read actual frequency
// data. This one doesn't claim to represent anything; it's just motion.
const EQ_BAR_DELAYS = [0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2];

interface LogEntry {
  time: string;
  tag: string;
  text: string;
}

export default function RadioCentralConsoleView() {
  const {
    station: playingStation,
    status,
    playStation,
    togglePlayPause,
    volume,
    setVolume,
    analyserRef,
    programManagerEnabled,
    activeProgramLabel,
  } = useRadioPlayer();

  const [activeCategory, setActiveCategory] = useState('COSMIC CHILL');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminStations, setAdminStations] = useState<LiveRadioStation[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  // Same real Supabase-session + app_metadata.role check every other
  // admin-only control in this app uses (see app/admin/radio-stations/
  // page.tsx) — not a client-spoofable localStorage flag. Gates the
  // per-channel delete "X" below; the server independently re-checks via
  // requireAdmin() on the DELETE call itself either way.
  const [isAdmin, setIsAdmin] = useState(false);
  // Station ids removed this session. Admin-added stations are deleted for
  // real via the API below; RADIO_STATIONS entries are hardcoded source
  // data with nothing to delete server-side, so removing one of those just
  // hides it from this browser tab until the page reloads.
  const [hiddenStationIds, setHiddenStationIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.app_metadata?.role === 'admin');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(session?.user?.app_metadata?.role === 'admin');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleRemoveStation = async (station: RadioStation) => {
    const isAdminStation = adminStations.some((s) => s.id === station.id);
    if (!isAdminStation) {
      setHiddenStationIds((prev) => new Set(prev).add(station.id));
      return;
    }
    setDeletingId(station.id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/admin/radio-stations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: station.id }),
      });
      if (res.ok) setAdminStations((prev) => prev.filter((s) => s.id !== station.id));
    } finally {
      setDeletingId(null);
    }
  };

  // Upload (+) — a custom user-supplied track (file or direct link), stored
  // in local state as the active custom source and tuned in via the same
  // playStation the rest of Radio Central uses, so it shows up in the
  // bottom player bar exactly like any curated station.
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLinkInput, setUploadLinkInput] = useState('');
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  // Tracks the current custom track's blob URL so it can be revoked when
  // replaced or when this view unmounts — object URLs otherwise leak.
  const customBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (customBlobUrlRef.current) URL.revokeObjectURL(customBlobUrlRef.current);
    };
  }, []);

  const loadCustomStation = (streamUrl: string, name: string) => {
    const customStation: LiveRadioStation = {
      kind: 'live',
      id: `custom-upload-${Date.now()}`,
      name,
      network: 'Custom Upload',
      tagline: 'Your uploaded track',
      genre: 'Custom',
      category: 'ALL CHANNELS',
      streamUrl,
      badge: '♪',
      badgeColor: '#7c3aed',
    };
    playStation(customStation);
    setShowUploadModal(false);
    setUploadLinkInput('');
  };

  const handleUploadFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (customBlobUrlRef.current) URL.revokeObjectURL(customBlobUrlRef.current);
    const url = URL.createObjectURL(file);
    customBlobUrlRef.current = url;
    loadCustomStation(url, file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleUploadLinkSubmit = () => {
    const url = uploadLinkInput.trim();
    if (!url) return;
    loadCustomStation(url, url.split('/').pop() || 'Custom Stream');
  };

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

  const allStations = [...RADIO_STATIONS, ...adminStations];
  const query = searchQuery.trim().toLowerCase();
  const filteredStations = allStations.filter((s) => {
    if (hiddenStationIds.has(s.id)) return false;
    const matchesCategory = activeCategory === 'ALL CHANNELS' ? s.category !== 'NEWS' : s.category === activeCategory;
    const matchesSearch = !query || s.name.toLowerCase().includes(query) || s.tagline.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const handleTuneIn = (station: RadioStation) => {
    if (playingStation?.id === station.id) {
      togglePlayPause();
      return;
    }
    playStation(station);
  };

  // Real event log — every actual station change during this session, not
  // scripted filler. Capped so it doesn't grow unbounded on a long visit.
  const [log, setLog] = useState<LogEntry[]>([]);
  const lastLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!playingStation || lastLoggedRef.current === playingStation.id) return;
    lastLoggedRef.current = playingStation.id;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLog((prev) =>
      [{ time, tag: programManagerEnabled ? 'PROGRAM' : 'STATION', text: `Now tuned: ${playingStation.name}` }, ...prev].slice(0, 12)
    );
  }, [playingStation, programManagerEnabled]);
  useEffect(() => {
    if (!activeProgramLabel) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLog((prev) => [{ time, tag: 'PROGRAM', text: `Block active: ${activeProgramLabel}` }, ...prev].slice(0, 12));
  }, [activeProgramLabel]);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

  const cardStyle: React.CSSProperties = { background: TOKENS.card, border: glowBorder, boxShadow: glowShadow };
  const subpanelStyle: React.CSSProperties = { background: TOKENS.subpanel, border: glowBorder };

  return (
    <div
      className="w-full h-full overflow-y-auto"
      style={{ background: TOKENS.base, color: '#e7f6ff', fontFamily: monoFont }}
    >
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 p-4 rounded-xl md:flex-row md:items-center md:justify-between" style={cardStyle}>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full"
              style={{ ...subpanelStyle, color: TOKENS.cyan }}
            >
              <AudioLines className="w-3.5 h-3.5" />
              432Hz
            </span>
            <button
              onClick={() => setShowUploadModal(true)}
              aria-label="Upload audio"
              title="Upload audio"
              className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 transition hover:brightness-125"
              style={{ background: TOKENS.cyan, color: '#03121a', boxShadow: '0 0 14px rgba(0,242,254,0.5)' }}
            >
              <Plus className="w-6 h-6" strokeWidth={3} />
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-[0.2em] text-white">RADIO CENTRAL</h1>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: TOKENS.cyan }}>
              Live streaming stations, curated ambient/cosmic channels
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Program Manager</span>
            {/* Disabled — Radio Central is manual-selection-only. The
                rotation engine in RadioPlayerContext is unreachable
                (toggleProgramManager only ever turns it off), and this
                badge is fixed in the off position to match: no click
                handler, no hover affordance, always "Off". */}
            <button
              disabled
              aria-disabled="true"
              title="Program Manager is disabled — manual station selection only"
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full cursor-not-allowed"
              style={{ ...subpanelStyle, color: '#64748b' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#64748b' }} />
                Program Manager &bull; Off
              </span>
            </button>
          </div>
        </div>

        {/* Filter sub-nav */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={cardStyle}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wide transition"
              style={
                activeCategory === cat
                  ? { background: 'rgba(0,242,254,0.12)', border: `1px solid ${TOKENS.cyan}`, color: TOKENS.cyan }
                  : { ...subpanelStyle, color: '#94a3b8' }
              }
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-2.5 top-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter stations..."
              className="w-full py-1.5 pl-8 pr-3 text-xs rounded-full outline-none"
              style={{ ...subpanelStyle, color: '#e2e8f0' }}
            />
          </div>
        </div>

        {/* Upper grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* On Air Now */}
          <div className="flex flex-col gap-3 p-4 rounded-xl" style={cardStyle}>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: TOKENS.crimson }}>
              On Air Now
            </span>
            <div
              className="flex items-center justify-between gap-4 p-4 rounded-lg"
              style={{ background: TOKENS.subpanel, border: `1px solid rgba(255,46,99,0.35)` }}
            >
              <div className="flex items-center min-w-0 gap-3">
                <div
                  className="flex items-center justify-center w-12 h-12 text-xs font-bold rounded shrink-0"
                  style={{ backgroundColor: playingStation?.badgeColor ?? '#3a3a3a' }}
                >
                  {playingStation?.badge ?? '—'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate text-white">{playingStation?.name ?? 'No station selected'}</h3>
                  <p className="text-xs truncate text-slate-400">{playingStation?.tagline ?? 'Pick a station below to begin'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <PlayerSpectrum analyserRef={analyserRef} isPlaying={isPlaying} width={64} height={24} />
                <button
                  onClick={() => playingStation && handleTuneIn(playingStation)}
                  disabled={!playingStation}
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide rounded disabled:opacity-40"
                  style={{ background: TOKENS.cyan, color: '#03121a' }}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isLoading ? 'Tuning' : isPlaying ? 'Pause' : 'Tune In'}
                </button>
              </div>
            </div>
            <div className="px-3 py-2 text-[10px] uppercase tracking-wide rounded" style={subpanelStyle}>
              <span style={{ color: TOKENS.emerald }}>● </span>
              Station Update: {playingStation ? `Now playing ${playingStation.name}` : 'Nothing playing yet'}
            </div>
          </div>

          {/* Program Manager status (replaces the mockup's fabricated "AI Program Director") */}
          <div className="flex flex-col gap-3 p-4 rounded-xl" style={cardStyle}>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: TOKENS.cyan }}>
              Program Manager Status
            </span>
            <div className="flex items-center gap-4 p-3 rounded-lg" style={subpanelStyle}>
              <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                <span
                  className="absolute inset-0 rounded-full core-pulse"
                  style={{ background: `radial-gradient(circle, rgba(0,242,254,0.55), rgba(168,85,247,0.35) 55%, transparent 75%)` }}
                />
                <span
                  className="absolute rounded-full inset-1"
                  style={{ border: `1px solid ${TOKENS.cyan}`, boxShadow: `0 0 12px rgba(0,242,254,0.5)` }}
                />
                <RadioIcon className="relative w-5 h-5" style={{ color: '#eafeff' }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  Status: <span style={{ color: programManagerEnabled ? TOKENS.emerald : '#94a3b8' }}>{programManagerEnabled ? 'Active' : 'Off'}</span>
                </p>
                <p className="text-xs font-bold text-white truncate">{activeProgramLabel ?? 'Manual station selection'}</p>
              </div>
            </div>
            <div className="p-3 space-y-1 overflow-y-auto rounded-lg h-36" style={subpanelStyle}>
              <div className="flex items-end justify-center h-4 gap-0.5 mb-1" aria-hidden="true">
                {EQ_BAR_DELAYS.map((delay, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-sm eq-bar"
                    style={{ background: TOKENS.cyan, animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
              {log.length === 0 ? (
                <p className="text-[10px] text-slate-500">No station events yet this session.</p>
              ) : (
                log.map((entry, i) => (
                  <p key={i} className="text-[10px] text-slate-400">
                    <span className="text-slate-600">{entry.time}</span>{' '}
                    <span style={{ color: TOKENS.cyan }}>[{entry.tag}]</span> {entry.text}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Middle grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* Channels */}
          <div className="p-4 space-y-2 rounded-xl" style={cardStyle}>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Channels</span>
            {filteredStations.map((s) => {
              const isActive = playingStation?.id === s.id;
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTuneIn(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTuneIn(s);
                    }
                  }}
                  className="flex items-center w-full gap-3 p-2.5 rounded-lg text-left transition cursor-pointer"
                  style={isActive ? { background: 'rgba(0,242,254,0.08)', border: `1px solid rgba(0,242,254,0.4)` } : subpanelStyle}
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 text-[10px] font-bold rounded shrink-0"
                    style={{ backgroundColor: s.badgeColor }}
                  >
                    {s.badge}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-white">{s.name}</p>
                    <p className="text-[10px] truncate text-slate-500">{s.tagline}</p>
                  </div>
                  {s.id === OFF_GRID_STATION_ID && (
                    <span
                      aria-label={isActive && isPlaying ? 'Pause Ai, Off Grid, and DIY' : 'Play Ai, Off Grid, and DIY'}
                      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                      style={{ background: 'rgba(0,242,254,0.15)', border: `1px solid ${TOKENS.cyan}` }}
                    >
                      {isActive && isPlaying ? (
                        <Pause className="w-4 h-4" style={{ color: TOKENS.cyan }} />
                      ) : (
                        <Play className="w-4 h-4" style={{ color: TOKENS.cyan }} />
                      )}
                    </span>
                  )}
                  {isActive && isPlaying && <PlayerSpectrum analyserRef={analyserRef} isPlaying width={36} height={16} />}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStation(s);
                      }}
                      disabled={deletingId === s.id}
                      aria-label={`Remove ${s.name}`}
                      title="Admin: remove channel"
                      className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Telemetry & controls — real numbers only */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Stations', value: String(allStations.length), sub: 'Available' },
                { label: 'Stream', value: status.toUpperCase(), sub: 'Status' },
                { label: 'Volume', value: `${Math.round(volume * 100)}%`, sub: 'Output' },
              ].map((m) => (
                <div key={m.label} className="p-3 text-center rounded-xl" style={cardStyle}>
                  <p
                    className="text-xl font-bold leading-tight"
                    style={{ color: TOKENS.cyan, textShadow: `0 0 12px rgba(0,242,254,0.6)` }}
                  >
                    {m.value}
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="p-4 space-y-3 rounded-xl" style={cardStyle}>
              <span className="text-[10px] uppercase tracking-widest text-slate-400">Station Control</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowSchedule((v) => !v)}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg"
                  style={subpanelStyle}
                >
                  <RadioIcon className="w-4 h-4" style={{ color: TOKENS.cyan }} />
                  <span className="text-[9px] uppercase tracking-wide text-slate-400">Schedule</span>
                </button>
                <div className="flex flex-col items-center gap-1 p-3 rounded-lg" style={subpanelStyle}>
                  <Volume2 className="w-4 h-4" style={{ color: TOKENS.cyan }} />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
              {showSchedule && (
                <div className="p-3 space-y-1 text-[10px] rounded-lg" style={subpanelStyle}>
                  <p className="text-slate-500">8 min per station, rotating: 432Hz Cosmic → .977 Comedy → .977 Smooth Jazz → History Radio (shuffled after 432Hz)</p>
                  <p className="text-slate-500">1-minute Commercials &amp; Ads Loop between every station change</p>
                  <p className="text-slate-500">Starts automatically the first time you press Play · pick any station directly to override</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Now Playing HUD */}
        <div className="flex flex-col items-center gap-4 p-4 rounded-xl sm:flex-row" style={cardStyle}>
          <div
            className="relative flex items-center justify-center w-16 h-16 rounded-full shrink-0"
            style={{
              background: `radial-gradient(circle, rgba(0,242,254,0.18), ${TOKENS.subpanel} 70%)`,
              border: `1px solid ${TOKENS.cyan}`,
              boxShadow: isPlaying ? `0 0 20px rgba(0,242,254,0.4)` : glowShadow,
            }}
          >
            <Headphones
              className="w-7 h-7"
              style={{ color: '#eafeff', filter: `drop-shadow(0 0 6px rgba(0,242,254,0.8))` }}
            />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Now Playing</p>
            <h3 className="text-base font-bold text-white truncate">{playingStation?.name ?? 'Nothing selected'}</h3>
            <p className="text-xs text-slate-500">Live from Radio Central</p>
          </div>
          <button
            onClick={() => playingStation && handleTuneIn(playingStation)}
            disabled={!playingStation}
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wide rounded disabled:opacity-40 shrink-0"
            style={{ background: TOKENS.cyan, color: '#03121a' }}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause' : 'Tune In'}
          </button>
          <PlayerSpectrum analyserRef={analyserRef} isPlaying={isPlaying} width={100} height={32} />
        </div>

        {/* Full-width visualizer */}
        <div className="p-4 rounded-xl" style={cardStyle}>
          <div className="flex items-center justify-center h-16">
            <FullWidthSpectrum analyserRef={analyserRef} isPlaying={isPlaying} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 text-center text-[10px] uppercase tracking-widest text-slate-500">
          Radio Central · Live · Always On
        </div>
      </div>

      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(2,4,8,0.7)' }}
          onClick={() => setShowUploadModal(false)}
        >
          <div className="w-full max-w-sm p-5 space-y-4 rounded-xl" style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-white uppercase">Upload Audio</h2>
              <button onClick={() => setShowUploadModal(false)} aria-label="Close" className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => uploadFileInputRef.current?.click()}
              className="flex items-center justify-center w-full gap-2 py-3 text-xs font-bold uppercase tracking-wide rounded-lg"
              style={{ background: TOKENS.cyan, color: '#03121a' }}
            >
              <Upload className="w-4 h-4" />
              Choose Audio File
            </button>
            <input
              ref={uploadFileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,audio/*"
              className="hidden"
              onChange={handleUploadFileSelect}
            />
            <p className="text-[10px] text-center uppercase tracking-widest text-slate-500">MP3 · WAV · M4A</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={uploadLinkInput}
                onChange={(e) => setUploadLinkInput(e.target.value)}
                placeholder="Paste a direct audio link..."
                className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                style={{ ...subpanelStyle, color: '#e2e8f0' }}
              />
              <button
                onClick={handleUploadLinkSubmit}
                disabled={!uploadLinkInput.trim()}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg disabled:opacity-40"
                style={subpanelStyle}
              >
                Load Link
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes corePulse {
          0%, 100% { transform: scale(0.92); opacity: 0.75; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .core-pulse {
          animation: corePulse 2.4s ease-in-out infinite;
        }
        @keyframes eqBar {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .eq-bar {
          height: 20%;
          animation: eqBar 0.9s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// A wider variant of the same real analyser-driven rendering as
// PlayerSpectrum, sized for the full-width HUD strip rather than a
// fixed-size canvas — same data source, just responsive width via ResizeObserver.
function FullWidthSpectrum({
  analyserRef,
  isPlaying,
}: {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isPlaying: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let animationId: number;
    const render = () => {
      const analyser = analyserRef.current;
      if (!analyser || !isPlaying) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationId = requestAnimationFrame(render);
        return;
      }
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(0, 242, 254, ${dataArray[i] / 255 + 0.2})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [analyserRef, isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
