'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Headphones, Play, Pause, Plus, Radio as RadioIcon, Search, Upload, Volume2, X } from 'lucide-react';
import { useRadioPlayer } from './RadioPlayerContext';
import PlayerSpectrum from './PlayerSpectrum';
import { supabase } from '@/lib/supabase';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MEDIA_GENRE_FILTERS,
  RADIO_STATIONS,
  type LiveRadioStation,
  type RadioStation,
} from '@/lib/radioStations';
import { isBannedTrackTitle } from '@/lib/bannedTracks';
import styles from './RadioCentralConsoleView.module.css';

// The Daily Queue's lineup: every currently available Supabase catalog
// audio item (catalogStations — video items never reach this list, see
// mapCatalogItemToStation's own video exclusion), each followed by a
// fixed BBC News block. Built dynamically rather than matching a specific
// title, so it stays correct as more audio items get ingested later
// rather than staying pinned to whichever one existed when this was
// written. Each audio item has no durationMs — it plays to its own real
// 'ended' event rather than being cut off by a timer; only the BBC block
// (a continuous stream with no natural end) uses one.
const DAILY_QUEUE_BBC_BLOCK_MS = 35 * 60 * 1000;
const DAILY_BBC_STATION_ID = 'bbc-world';

interface MediaCatalogItem {
  id?: string;
  rawTitle: string;
  url: string;
  channel?: string;
  mediaType?: 'audio' | 'video';
  metadata?: { category?: string; genre?: string; [key: string]: unknown };
}

// Maps a persisted Supabase media_catalog row (GET /api/v1/media/catalog)
// into a real RadioStation. Video items are excluded — Radio Central is an
// audio-only dial, the same gate MediaFlowAudioCenter's sendToRadioCentral
// already applies (mediaType === 'audio' only; video goes to Studio One
// instead), so this doesn't invent a new rule.
function mapCatalogItemToStation(item: MediaCatalogItem): LiveRadioStation | null {
  if (item.mediaType === 'video') return null;
  const { category, genre } = item.metadata ?? {};
  return {
    kind: 'live',
    id: `media-catalog-${item.id}`,
    name: item.rawTitle,
    network: item.channel === 'INTERNET_ARCHIVE' ? 'Internet Archive' : item.channel || 'Media Matrix',
    tagline: [genre, category].filter(Boolean).join(' • ') || 'From the Media Matrix catalog',
    genre: genre || category || 'Media Catalog',
    category: category || 'Media Catalog',
    streamUrl: item.url,
    badge: 'MTX',
    badgeColor: '#8b5cf6',
  };
}

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
  // The holographic shell's oil-slick edge gradient — distinct from the
  // single-tone cyan glow used everywhere else in this view, deliberately
  // reserved for the outer casing and a handful of marquee controls so it
  // reads as a special "metal + light" treatment rather than replacing
  // the existing cyan HUD language wholesale.
  holoA: '#2fd9ff',
  holoB: '#b63cff',
  holoC: '#ff00a0',
};

// Holographic Glass — shared Tailwind class strings for every interactive
// surface (buttons, filter pills, tune buttons, channel rows, metric
// tiles): an idle state that's a translucent iridescent sheen rather than
// a flat fill, an active/selected state with a vivid spectrum edge glow,
// and a hover state that "ignites" further. Centralized here (not
// hand-typed at each of the ~10 usage sites) so the look stays consistent
// and any future tuning happens in one place. These replace the flat
// background colors this file's inline `style` objects used to set at
// each of those sites — Tailwind's gradient/opacity utilities aren't
// reproducible from a plain CSS-in-JS object without re-deriving the same
// color-mix math by hand.
const GLASS_IDLE =
  'bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md border border-cyan-300/40 border-t-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)] text-slate-200 hover:from-cyan-300/40 hover:via-purple-400/35 hover:to-pink-500/40 hover:border-cyan-200/70 hover:shadow-[0_0_20px_rgba(182,60,255,0.5)] transition-all duration-300';
const GLASS_ACTIVE =
  'bg-gradient-to-r from-cyan-400/40 via-fuchsia-500/40 to-indigo-500/40 backdrop-blur-md border border-cyan-200/80 text-white font-medium shadow-[0_0_18px_rgba(47,217,255,0.5),inset_0_1px_3px_rgba(255,255,255,0.6)] hover:from-cyan-300/40 hover:via-purple-400/35 hover:to-pink-500/40 hover:shadow-[0_0_24px_rgba(182,60,255,0.6)] transition-all duration-300';
// Same glass mechanics as GLASS_ACTIVE, tinted emerald instead of cyan —
// reserved for Program Manager/Daily Queue's real "this automation is
// currently running" state, which is a meaningfully different fact than
// "this filter is selected" and shouldn't collapse into the same color.
const GLASS_ACTIVE_GREEN =
  'bg-gradient-to-r from-emerald-400/40 via-teal-400/40 to-emerald-600/40 backdrop-blur-md border border-emerald-200/80 text-white font-medium shadow-[0_0_18px_rgba(0,245,160,0.5),inset_0_1px_3px_rgba(255,255,255,0.6)] hover:shadow-[0_0_24px_rgba(0,245,160,0.65)] transition-all duration-300';

const glowShadow = `0 0 15px rgba(0,242,254,0.15)`;
const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Glassmorphic panel base — every cardStyle/subpanelStyle consumer below
// (there are ~15 of them) picks this up automatically, so the "holographic
// metallic shell" upgrade reaches every panel without rewriting each call
// site individually. backdropFilter is real CSS, not a Tailwind class,
// but functions identically (no JS, no extra library) — inline style was
// already this file's own convention before this pass.
const glassBlur: React.CSSProperties = { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' };

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
    toggleProgramManager,
    dailyQueueEnabled,
    activeDailyQueueLabel,
    startDailyQueue,
    stopDailyQueue,
  } = useRadioPlayer();

  const [activeCategory, setActiveCategory] = useState('COSMIC CHILL');
  const [activeGenreFilter, setActiveGenreFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminStations, setAdminStations] = useState<LiveRadioStation[]>([]);
  const [catalogStations, setCatalogStations] = useState<LiveRadioStation[]>([]);
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
        if (cancelled || !Array.isArray(data.stations)) return;
        // Defensive denylist (see lib/bannedTracks) — filtered at the
        // source so both allStations below AND the Daily Queue (which
        // reads catalogStations directly, not allStations) benefit.
        setAdminStations(data.stations.filter((s: RadioStation) => !isBannedTrackTitle(s.name) && !isBannedTrackTitle(s.tagline)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/media/catalog')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.items)) return;
        const mapped = (data.items as MediaCatalogItem[])
          .map(mapCatalogItemToStation)
          .filter((s): s is LiveRadioStation => s !== null && !isBannedTrackTitle(s.name));
        setCatalogStations(mapped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const allStations = [...RADIO_STATIONS, ...adminStations, ...catalogStations];
  const query = searchQuery.trim().toLowerCase();
  const activeGenreKeywords = MEDIA_GENRE_FILTERS.find((g) => g.label === activeGenreFilter)?.keywords ?? null;
  const filteredStations = allStations.filter((s) => {
    if (hiddenStationIds.has(s.id)) return false;
    const matchesCategory = activeCategory === 'ALL CHANNELS' ? s.category !== 'NEWS' : s.category === activeCategory;
    const matchesSearch = !query || s.name.toLowerCase().includes(query) || s.tagline.toLowerCase().includes(query);
    const matchesGenre = !activeGenreKeywords || activeGenreKeywords.some((k) => s.genre.toLowerCase().includes(k));
    return matchesCategory && matchesSearch && matchesGenre;
  });

  // Resolves the Daily Queue from whatever's currently loaded — null
  // until there's at least one audio catalog item and BBC is available,
  // so the toggle button below can disable itself rather than start a
  // broken, empty queue. Interleaves a 35-minute BBC News block after
  // every audio item, cycling indefinitely (advanceDailyQueue in
  // RadioPlayerContext.tsx loops the whole array, not just this pass).
  const dailyQueueItems = (() => {
    const bbc = allStations.find((s) => s.id === DAILY_BBC_STATION_ID);
    if (!bbc || catalogStations.length === 0) return null;
    return catalogStations.flatMap((audioItem) => [
      { station: audioItem }, // plays to its own real end, no timer
      { station: bbc, durationMs: DAILY_QUEUE_BBC_BLOCK_MS },
    ]);
  })();

  const handleToggleDailyQueue = () => {
    if (dailyQueueEnabled) {
      stopDailyQueue();
      return;
    }
    if (dailyQueueItems) startDailyQueue(dailyQueueItems);
  };

  // Polls the backend's externally-controllable broadcast state
  // (routers/radio.py — an n8n workflow or any other automation can flip
  // it via POST /api/v1/radio/toggle) and applies it locally through the
  // exact same startDailyQueue/toggleProgramManager the manual buttons
  // use. Remote state is treated as authoritative — it's a real remote
  // control, not just a suggestion, so it can override a manual toggle on
  // the next poll. Only reconciles Daily Queue when dailyQueueItems is
  // actually available, so a "turn on" command can't start an empty queue.
  // autoplay: false — this fires with no user gesture behind it, so it
  // arms/loads the queue (the toggle shows On, a track is ready) without
  // attempting real playback; the user's own Play press is what actually
  // starts audio, same contract as a fresh page load.
  useEffect(() => {
    let cancelled = false;
    const reconcile = async () => {
      try {
        const res = await fetch('/api/v1/radio/state');
        if (!res.ok || cancelled) return;
        const remote: { daily_queue?: boolean; program_manager?: boolean } = await res.json();

        if (remote.daily_queue && !dailyQueueEnabled && dailyQueueItems) {
          startDailyQueue(dailyQueueItems, { autoplay: false });
        } else if (remote.daily_queue === false && dailyQueueEnabled) {
          stopDailyQueue();
        }

        if (typeof remote.program_manager === 'boolean' && remote.program_manager !== programManagerEnabled) {
          toggleProgramManager();
        }
      } catch {
        // Remote state unreachable — leave local state as-is.
      }
    };
    reconcile();
    const interval = setInterval(reconcile, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dailyQueueEnabled, programManagerEnabled, dailyQueueItems, startDailyQueue, stopDailyQueue, toggleProgramManager]);

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
  useEffect(() => {
    if (!activeDailyQueueLabel) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLog((prev) => [{ time, tag: 'DAILY QUEUE', text: `Now playing: ${activeDailyQueueLabel}` }, ...prev].slice(0, 12));
  }, [activeDailyQueueLabel]);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

  // 3D glass edge — every internal sub-panel gets a real lit top edge
  // (inset highlight) plus a real cast shadow (drop below it), not just a
  // flat translucent fill, so panels read as floating glass on top of the
  // recessed screen behind them rather than being painted onto it.
  const cardStyle: React.CSSProperties = {
    ...glassBlur,
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 8px 16px rgba(0,0,0,0.6)',
  };
  const subpanelStyle: React.CSSProperties = {
    ...glassBlur,
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(0,242,254,0.2)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.5)',
  };

  return (
    <div
      className="w-full h-full overflow-y-auto p-3 sm:p-6 md:p-10"
      style={{ background: TOKENS.base, color: '#e7f6ff', fontFamily: monoFont }}
    >
      {/* Holographic Metallic Shell Wrap — the whole dashboard sits inside
          one bulky armored casing: an outer iridescent "oil-slick" edge
          (holo-shell-edge, an animated 3-stop gradient shifted via
          background-position) with a 2px reveal around an inner metal
          shell (dark slate/zinc gradient, industrial bezel, corner
          brackets, rivets). Both are plain scoped CSS in the <style jsx>
          block below — no animation library, same performance profile as
          this file's existing corePulse/eqBar keyframes. */}
      <div className="relative max-w-6xl mx-auto">
        <div className={`${styles.holoShellEdge} rounded-[2rem] p-[3px]`}>
          <div className={`${styles.metalShell} relative rounded-[calc(2rem-3px)] p-3 sm:p-6 overflow-hidden`}>
            <span className={`${styles.cornerCut} ${styles.cornerCutTl}`} aria-hidden="true" />
            <span className={`${styles.cornerCut} ${styles.cornerCutTr}`} aria-hidden="true" />
            <span className={`${styles.cornerCut} ${styles.cornerCutBl}`} aria-hidden="true" />
            <span className={`${styles.cornerCut} ${styles.cornerCutBr}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerBracketTl}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerBracketTr}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerBracketBl}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerBracketBr}`} aria-hidden="true" />
            <span className={styles.rivet} style={{ top: 16, left: 16 }} aria-hidden="true" />
            <span className={styles.rivet} style={{ top: 16, right: 16 }} aria-hidden="true" />
            <span className={styles.rivet} style={{ bottom: 16, left: 16 }} aria-hidden="true" />
            <span className={styles.rivet} style={{ bottom: 16, right: 16 }} aria-hidden="true" />
            {/* Ventilation grilles — hardware detail along the top edge,
                clear of the corner brackets/rivets. */}
            <span className={styles.ventSlits} style={{ top: 14, left: '50%', transform: 'translateX(-140px)' }} aria-hidden="true" />
            <span className={styles.ventSlits} style={{ top: 14, left: '50%', transform: 'translateX(106px)' }} aria-hidden="true" />

            {/* Recessed screen pit — the real dashboard content (header
                through footer) sits visibly set back from the metal
                casing around it, like a real device's display glass. */}
            <div className={`${styles.screenRecess} relative rounded-[1.25rem] p-4 sm:p-8 md:p-10 space-y-4 overflow-hidden`}>
              {/* CRT/scanline micro-pattern — a barely-there diagonal
                  repeating-gradient over the recessed screen so it reads
                  as the display surface itself rather than a decal on any
                  single panel. */}
              <div className={styles.scanlineOverlay} aria-hidden="true" />
        {/* Header */}
        <div className="flex flex-col gap-4 p-4 rounded-xl md:flex-row md:items-center md:justify-between" style={cardStyle}>
          <div className="flex items-center gap-3">
            <span className={`${GLASS_IDLE} flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full !text-cyan-200`}>
              <AudioLines className="w-3.5 h-3.5" style={{ filter: `drop-shadow(0 0 6px rgba(47,217,255,0.6))` }} />
              432Hz
            </span>
            <button
              onClick={() => setShowUploadModal(true)}
              aria-label="Upload audio"
              title="Upload audio"
              className={`${GLASS_ACTIVE} flex items-center justify-center w-11 h-11 rounded-full shrink-0`}
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
            {/* A real, deliberate toggle — this is the only way Program
                Manager can start. It never auto-enables itself (see the
                comment on toggleProgramManager in RadioPlayerContext.tsx
                for why that matters). */}
            <button
              onClick={toggleProgramManager}
              title={programManagerEnabled ? 'Turn off Program Manager rotation' : 'Turn on Program Manager rotation'}
              className={`${programManagerEnabled ? GLASS_ACTIVE_GREEN : GLASS_IDLE} px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: programManagerEnabled ? TOKENS.emerald : '#64748b' }}
                />
                Program Manager &bull; {programManagerEnabled ? 'On' : 'Off'}
              </span>
            </button>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Daily Queue</span>
            {/* Same "explicit toggle, never auto-starts" contract as
                Program Manager above — mutually exclusive with it (see
                startDailyQueue/startProgramManager in
                RadioPlayerContext.tsx). Disabled until at least one audio
                catalog item and BBC World Service are available, so it
                can't kick off an empty sequence. */}
            <button
              onClick={handleToggleDailyQueue}
              disabled={!dailyQueueEnabled && !dailyQueueItems}
              title={
                dailyQueueEnabled
                  ? 'Turn off the Daily Queue'
                  : dailyQueueItems
                    ? 'Turn on the Daily Queue (catalog audio → 35min BBC News → next catalog audio → …)'
                    : 'Daily Queue unavailable — waiting on an audio item in the catalog'
              }
              className={`${dailyQueueEnabled ? GLASS_ACTIVE_GREEN : GLASS_IDLE} px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full disabled:opacity-40`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: dailyQueueEnabled ? TOKENS.emerald : '#64748b' }}
                />
                Daily Queue &bull; {dailyQueueEnabled ? 'On' : 'Off'}
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
              className={`${activeCategory === cat ? GLASS_ACTIVE : GLASS_IDLE} px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wide`}
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

        {/* Mini-category sub-nav — a finer genre facet layered on top of
            the CATEGORIES tabs above (see MEDIA_GENRE_FILTERS in
            lib/radioStations.ts), aimed at narrative/archival catalog
            content. Applied as an additional AND filter, not a
            replacement for the active category tab. */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={cardStyle}>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0">Genre</span>
          {MEDIA_GENRE_FILTERS.map((genreFilter) => (
            <button
              key={genreFilter.label}
              onClick={() => setActiveGenreFilter((current) => (current === genreFilter.label ? null : genreFilter.label))}
              className={`${activeGenreFilter === genreFilter.label ? GLASS_ACTIVE : GLASS_IDLE} px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wide`}
            >
              {genreFilter.label}
            </button>
          ))}
        </div>

        {/* Upper grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* On Air Now */}
          <div className="flex flex-col gap-3 p-4 rounded-xl" style={cardStyle}>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: TOKENS.crimson }}>
              On Air Now
            </span>
            <div
              className="flex items-center justify-between gap-4 p-4 rounded-lg transition-shadow duration-700"
              style={{
                background: TOKENS.subpanel,
                border: `1px solid rgba(255,46,99,0.35)`,
                boxShadow: isPlaying
                  ? `inset 0 0 30px rgba(47,217,255,0.12), 0 0 24px rgba(255,46,99,0.3)`
                  : 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
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
                {/* Real analyser-driven waveform (see PlayerSpectrum) —
                    the drop-shadow filter is purely a volumetric glow on
                    top of genuine frequency data, not a fabricated visual. */}
                <div style={{ filter: isPlaying ? `drop-shadow(0 0 8px rgba(47,217,255,0.7))` : undefined }}>
                  <PlayerSpectrum analyserRef={analyserRef} isPlaying={isPlaying} width={64} height={24} />
                </div>
                <button
                  onClick={() => playingStation && handleTuneIn(playingStation)}
                  disabled={!playingStation}
                  className={`${GLASS_ACTIVE} flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide rounded disabled:opacity-40`}
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
                  className={`absolute inset-0 rounded-full ${styles.corePulse}`}
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
                    className={`w-1 rounded-sm ${styles.eqBar}`}
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
                  className={`${isActive ? GLASS_ACTIVE : GLASS_IDLE} ${styles.chanTile} flex items-center w-full gap-3 p-2.5 rounded-lg text-left cursor-pointer`}
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
                <div key={m.label} className={`${styles.tile3d} p-3 text-center rounded-xl`} style={cardStyle}>
                  <p
                    className="text-xl font-bold leading-tight"
                    style={{ color: TOKENS.cyan, filter: `drop-shadow(0 0 12px ${TOKENS.holoA})` }}
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
                  className={`${styles.tile3d} flex flex-col items-center gap-1 p-3 rounded-lg`}
                  style={subpanelStyle}
                >
                  <RadioIcon className="w-4 h-4" style={{ color: TOKENS.cyan, filter: `drop-shadow(0 0 6px rgba(47,217,255,0.6))` }} />
                  <span className="text-[9px] uppercase tracking-wide text-slate-400">Schedule</span>
                </button>
                <div className={`${styles.tile3d} flex flex-col items-center gap-1 p-3 rounded-lg`} style={subpanelStyle}>
                  <Volume2 className="w-4 h-4" style={{ color: TOKENS.cyan, filter: `drop-shadow(0 0 6px rgba(47,217,255,0.6))` }} />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className={`${styles.cyberSlider} w-full`}
                    style={{ '--fill': `${Math.round(volume * 100)}%` } as React.CSSProperties}
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
            className={`${GLASS_ACTIVE} flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wide rounded disabled:opacity-40 shrink-0`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause' : 'Tune In'}
          </button>
          <div style={{ filter: isPlaying ? `drop-shadow(0 0 10px rgba(47,217,255,0.7))` : undefined }}>
            <PlayerSpectrum analyserRef={analyserRef} isPlaying={isPlaying} width={100} height={32} />
          </div>
        </div>

        {/* Full-width visualizer */}
        <div className="p-4 rounded-xl" style={{ ...cardStyle, boxShadow: `${cardStyle.boxShadow}, inset 0 4px 10px rgba(0,0,0,0.6)` }}>
          <div className="flex items-center justify-center h-16" style={{ filter: isPlaying ? `drop-shadow(0 0 12px rgba(47,217,255,0.6))` : undefined }}>
            <FullWidthSpectrum analyserRef={analyserRef} isPlaying={isPlaying} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 text-center text-[10px] uppercase tracking-widest text-slate-500">
          Radio Central · Live · Always On
        </div>
            </div>
          </div>
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
              className={`${GLASS_ACTIVE} flex items-center justify-center w-full gap-2 py-3 text-xs font-bold uppercase tracking-wide rounded-lg`}
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
                className={`${GLASS_IDLE} w-full py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg disabled:opacity-40`}
              >
                Load Link
              </button>
            </div>
          </div>
        </div>
      )}
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
