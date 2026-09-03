'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Film, X, Pencil, Check, Loader2, Radio, Mic } from 'lucide-react';
import type WaveSurfer from 'wavesurfer.js';
import type Webamp from 'webamp';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';
import type { LiveRadioStation } from '@/lib/radioStations';
import { extractIdentifier } from '@/lib/archiveOrg';

export interface CatalogTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  sourceIdentifier: string;
  mediaType: 'audio' | 'video';
}

const CATALOG_STORAGE_KEY = 'aione-media-center-catalog';

// Internet Archive's own format labels for playable audio/video files
// (from a real /metadata/<id> response's files[].format field) — anything
// else (text, image, .torrent, checksums, thumbnails, etc.) is skipped.
// Verified against real items: audio labels like "VBR MP3"/"Ogg Vorbis",
// and video labels like "h.264" (real .mp4 files) / "QuickTime" (.mov).
const AUDIO_FORMATS = new Set(['vbr mp3', 'mp3', 'ogg vorbis', 'flac', '24bit flac', 'wave', 'aiff']);
const VIDEO_FORMATS = new Set([
  'h.264', 'mpeg4', '512kb mpeg4', 'h.264 ia', 'quicktime', 'webm', 'ogg video', 'matroska',
  'windows media', 'mpeg2', 'mpeg1', 'flash video', 'dvix', '3gpp',
]);
// Extension fallback for the file-type examples called out explicitly
// (.mp4, .webm) and other common containers, in case a future format
// label isn't in the set above.
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|mkv|avi)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|aiff|m4a)$/i;

function detectMediaType(format: string | undefined, filename: string): 'audio' | 'video' | null {
  const fmt = format?.toLowerCase();
  if (fmt && VIDEO_FORMATS.has(fmt)) return 'video';
  if (fmt && AUDIO_FORMATS.has(fmt)) return 'audio';
  if (VIDEO_EXTENSIONS.test(filename)) return 'video';
  if (AUDIO_EXTENSIONS.test(filename)) return 'audio';
  return null;
}

// Real Internet Archive metadata API — no auth, CORS-enabled, documented
// at https://archive.org/developers/metadata-schema.html. Throws with a
// real, user-facing reason on anything unexpected rather than silently
// returning nothing.
async function fetchArchiveTracks(identifier: string): Promise<CatalogTrack[]> {
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error(`Internet Archive lookup failed (${res.status}).`);
  const data = await res.json();
  const files: Array<{ name: string; format?: string; title?: string }> = data.files || [];
  if (files.length === 0) throw new Error(`No item found for "${identifier}".`);

  const itemTitle: string = data.metadata?.title || identifier;
  const itemCreatorRaw = data.metadata?.creator;
  const itemCreator = Array.isArray(itemCreatorRaw) ? itemCreatorRaw.join(', ') : itemCreatorRaw || itemTitle;

  const mediaFiles = files
    .map((f) => ({ file: f, mediaType: detectMediaType(f.format, f.name) }))
    .filter((x): x is { file: typeof files[number]; mediaType: 'audio' | 'video' } => x.mediaType !== null);
  if (mediaFiles.length === 0) throw new Error(`"${itemTitle}" has no playable audio or video files.`);

  return mediaFiles.map(({ file: f, mediaType }) => ({
    id: `${identifier}::${f.name}`,
    title: f.title || f.name.replace(/\.[^/.]+$/, '') || itemTitle,
    artist: itemCreator,
    url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
    sourceIdentifier: identifier,
    mediaType,
  }));
}

interface ParsedFeedEpisode {
  title: string;
  description: string;
  pubDate: string;
  enclosureUrl: string;
}

// Proxied server-side (app/api/podcast-feed/route.ts) — most RSS hosts
// aren't CORS-enabled, unlike the Internet Archive metadata API above.
async function fetchFeedTracks(feedUrl: string): Promise<CatalogTrack[]> {
  const res = await fetch(`/api/podcast-feed?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error(await res.text());
  const data: { feedTitle: string; episodes: ParsedFeedEpisode[] } = await res.json();
  if (data.episodes.length === 0) throw new Error('That feed has no playable audio episodes.');

  return data.episodes.map((ep) => ({
    id: `feed::${feedUrl}::${ep.enclosureUrl}`,
    title: ep.title,
    artist: data.feedTitle,
    url: ep.enclosureUrl,
    sourceIdentifier: feedUrl,
    mediaType: 'audio',
  }));
}

// A bare .mp3/direct-stream link skips the feed parser entirely — no
// server round-trip needed, it's already a playable URL.
function buildDirectAudioTrack(url: string): CatalogTrack {
  const filename = url.split('/').pop()?.split('?')[0] ?? '';
  const title = decodeURIComponent(filename.replace(/\.[^/.]+$/, '')) || 'Audio Track';
  return {
    id: `feed::${url}`,
    title,
    artist: 'Direct Audio Link',
    url,
    sourceIdentifier: url,
    mediaType: 'audio',
  };
}

interface MediaFlowAudioCenterProps {
  // Optional one-shot hand-off to Studio One (components/PodsModule.tsx) —
  // app/page.tsx owns the actual navigation/state, since Studio One has no
  // shared context of its own to call into the way Radio Central does.
  onSendToStudioOne?: (track: { title: string; artist: string; url: string; mediaType: 'audio' | 'video' }) => void;
}

// A standalone player over the user's own Internet-Archive-sourced
// catalog — deliberately independent of RadioPlayerContext/RADIO_STATIONS
// now (no hardcoded stations, no shared audio element, no assumed default
// track). Wavesurfer manages its own internal audio via `url` rather than
// attaching to an external element, since there's no longer a shared
// engine to attach to. Replaces the earlier version of this component,
// which fed it from the app-wide Radio Central station list.
export default function MediaFlowAudioCenter({ onSendToStudioOne }: MediaFlowAudioCenterProps) {
  const [catalog, setCatalog] = useState<CatalogTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [archiveInput, setArchiveInput] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const [feedInput, setFeedInput] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');

  // One-shot hand-off only — see sendToRadioCentral below. Media Flow reads
  // nothing back from RadioPlayerContext and stores no radio state, so its
  // "deliberately independent" design (see the header comment above) holds.
  const { playStation } = useRadioPlayer();

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [waveformReady, setWaveformReady] = useState(false);

  // Video Mode's own element — a completely separate playback path from
  // Wavesurfer/audio, since only one of the two viewports is ever mounted
  // at a time (see currentTrack.mediaType below).
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const webampRef = useRef<Webamp | null>(null);
  const webampContainerRef = useRef<HTMLDivElement | null>(null);
  const [webampOpen, setWebampOpen] = useState(false);
  const [webampError, setWebampError] = useState('');

  // Load the persisted catalog once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (raw) setCatalog(JSON.parse(raw));
    } catch {
      // Corrupt or blocked storage — start empty rather than crash.
    }
  }, []);

  const persistCatalog = (next: CatalogTrack[]) => {
    setCatalog(next);
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full/blocked (private browsing, etc.) — the in-memory
      // list still works for the rest of this session.
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: WaveSurferCtor } = await import('wavesurfer.js');
      if (cancelled || !waveformRef.current) return;
      const ws = WaveSurferCtor.create({
        container: waveformRef.current,
        waveColor: 'rgba(34, 211, 238, 0.35)',
        progressColor: '#22d3ee',
        cursorColor: '#67e8f9',
        height: 72,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
      });
      wavesurferRef.current = ws;
      ws.setVolume(volume);
      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));
    })();
    return () => {
      cancelled = true;
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadIntoWavesurfer = (track: CatalogTrack, autoplay: boolean) => {
    if (!wavesurferRef.current) return;
    setWaveformReady(false);
    wavesurferRef.current.load(track.url);
    wavesurferRef.current.once('ready', () => {
      setWaveformReady(true);
      if (autoplay) wavesurferRef.current?.play();
    });
  };

  // Audio Mode uses Wavesurfer; Video Mode uses the plain <video> element
  // below — only one viewport is ever mounted for a given track, so
  // switching types stops whichever engine was previously active first.
  const playCatalogIndex = (index: number, list: CatalogTrack[] = catalog) => {
    const track = list[index];
    if (!track) return;
    wavesurferRef.current?.pause();
    videoRef.current?.pause();
    setCurrentIndex(index);
    if (track.mediaType === 'audio') {
      loadIntoWavesurfer(track, true);
    } else {
      setWaveformReady(false);
      // The <video> element's src is bound declaratively via currentTrack
      // in the JSX below; autoplay is kicked off once it's actually
      // mounted with the new src (see the effect that watches currentTrack).
    }
  };

  const togglePlayPause = () => {
    if (currentIndex === -1) {
      if (catalog.length > 0) playCatalogIndex(0);
      return;
    }
    const track = catalog[currentIndex];
    if (track?.mediaType === 'video') {
      if (videoRef.current?.paused) videoRef.current.play();
      else videoRef.current?.pause();
    } else {
      wavesurferRef.current?.playPause();
    }
  };

  const skipNext = () => {
    if (catalog.length === 0) return;
    playCatalogIndex(currentIndex === -1 ? 0 : (currentIndex + 1) % catalog.length);
  };

  const skipPrev = () => {
    if (catalog.length === 0) return;
    playCatalogIndex(currentIndex === -1 ? 0 : (currentIndex - 1 + catalog.length) % catalog.length);
  };

  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    wavesurferRef.current?.setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  };

  const handleArchiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setArchiveError('');
    const identifier = extractIdentifier(archiveInput);
    if (!identifier) {
      setArchiveError('Enter a valid Internet Archive item ID or URL.');
      return;
    }
    setArchiveLoading(true);
    try {
      const extracted = await fetchArchiveTracks(identifier);
      const existingIds = new Set(catalog.map((t) => t.id));
      const newTracks = extracted.filter((t) => !existingIds.has(t.id));
      const insertAt = catalog.length;
      const nextCatalog = [...catalog, ...newTracks];
      persistCatalog(nextCatalog);

      if (newTracks.length > 0) {
        // playCatalogIndex (not loadIntoWavesurfer directly) since the
        // first newly-extracted file could be either audio or video.
        playCatalogIndex(insertAt, nextCatalog);
        // Webamp is audio-only — only its own tracks go into an
        // already-open instance, per the "load directly into both Webamp
        // and Wavesurfer" requirement (video has its own viewport instead).
        const newAudioTracks = newTracks.filter((t) => t.mediaType === 'audio');
        if (newAudioTracks.length > 0) {
          webampRef.current?.appendTracks(
            newAudioTracks.map((t) => ({ url: t.url, metaData: { artist: t.artist, title: t.title } }))
          );
        }
      }
      setArchiveInput('');
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to load that item.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleFeedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedError('');
    const trimmed = feedInput.trim();
    if (!trimmed) {
      setFeedError('Enter a podcast RSS feed URL or a direct audio link.');
      return;
    }
    setFeedLoading(true);
    try {
      const extracted = AUDIO_EXTENSIONS.test(trimmed)
        ? [buildDirectAudioTrack(trimmed)]
        : await fetchFeedTracks(trimmed);
      const existingIds = new Set(catalog.map((t) => t.id));
      const newTracks = extracted.filter((t) => !existingIds.has(t.id));
      const insertAt = catalog.length;
      const nextCatalog = [...catalog, ...newTracks];
      persistCatalog(nextCatalog);

      if (newTracks.length > 0) {
        playCatalogIndex(insertAt, nextCatalog);
        webampRef.current?.appendTracks(
          newTracks.map((t) => ({ url: t.url, metaData: { artist: t.artist, title: t.title } }))
        );
      }
      setFeedInput('');
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Failed to load that feed.');
    } finally {
      setFeedLoading(false);
    }
  };

  // Explicit, one-shot hand-off to the global Radio Central player — not a
  // subscription. Mirrors RadioStreams.tsx's ad-hoc-station pattern exactly
  // (same BaseStation fields, same badge convention); app/api/radio/queue
  // already has a fallback path for any station id not in RADIO_STATIONS,
  // so this needs no backend changes. network: 'Media Flow' is the one
  // deliberate value difference, so the now-playing station visibly reads
  // as catalog-sourced rather than curated/searched.
  const sendToRadioCentral = (track: CatalogTrack) => {
    wavesurferRef.current?.pause();
    videoRef.current?.pause();
    const station: LiveRadioStation = {
      kind: 'live',
      id: `media-flow-${track.id}`,
      name: track.title,
      network: 'Media Flow',
      tagline: track.artist || 'From your Media Flow catalog',
      genre: track.mediaType === 'video' ? 'Video' : 'Audio',
      category: 'ALL CHANNELS',
      streamUrl: track.url,
      badge: '●',
      badgeColor: '#3a3a3a',
    };
    playStation(station);
  };

  const removeCatalogItem = (id: string) => {
    const index = catalog.findIndex((t) => t.id === id);
    const next = catalog.filter((t) => t.id !== id);
    persistCatalog(next);
    if (index === currentIndex) {
      wavesurferRef.current?.stop();
      setCurrentIndex(-1);
      setWaveformReady(false);
    } else if (index < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const startRename = (track: CatalogTrack) => {
    setRenamingId(track.id);
    setRenameDraft(track.title);
  };

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      persistCatalog(catalog.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    }
    setRenamingId(null);
  };

  const launchWebamp = async () => {
    setWebampError('');
    const { default: WebampCtor } = await import('webamp');
    if (!WebampCtor.browserIsSupported()) {
      setWebampError('This browser does not support Webamp (needs Web Audio API support).');
      return;
    }
    // Webamp decodes and plays audio independently — pause whichever
    // engine is currently active first so nothing plays over it.
    wavesurferRef.current?.pause();
    videoRef.current?.pause();

    // Webamp is audio-only — video items in the catalog aren't handed to it.
    const initialTracks = catalog
      .filter((t) => t.mediaType === 'audio')
      .map((t) => ({
        url: t.url,
        defaultName: t.title,
        metaData: { artist: t.artist, title: t.title },
      }));

    const webamp = new WebampCtor({ initialTracks });
    webampRef.current = webamp;
    webamp.onClose(() => {
      webamp.dispose();
      webampRef.current = null;
      setWebampOpen(false);
    });
    if (webampContainerRef.current) {
      await webamp.renderWhenReady(webampContainerRef.current);
    }
    setWebampOpen(true);
  };

  const closeWebamp = () => webampRef.current?.close();

  useEffect(() => {
    return () => {
      webampRef.current?.dispose();
    };
  }, []);

  const currentTrack = currentIndex >= 0 ? catalog[currentIndex] : null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Media Flow &amp; Audio Center</h2>
        <p className="mt-1 text-sm text-slate-400">
          Your own audio library — pull tracks straight from Internet Archive, organize them, and play them back
          with a real waveform and an optional Webamp window.
        </p>
      </div>

      {/* Internet Archive Direct Loader */}
      <form
        onSubmit={handleArchiveSubmit}
        className="p-5 mb-4 space-y-2 border rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md"
      >
        <span className="text-xs font-mono uppercase tracking-widest text-white/70">Load from Internet Archive</span>
        <div className="flex gap-2">
          <input
            value={archiveInput}
            onChange={(e) => setArchiveInput(e.target.value)}
            placeholder="Item ID or URL — e.g. rosen or https://archive.org/details/rosen"
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400/50"
          />
          <button
            type="submit"
            disabled={archiveLoading || !archiveInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide rounded bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 transition"
          >
            {archiveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {archiveLoading ? 'Loading…' : 'Load'}
          </button>
        </div>
        {archiveError && <p className="text-[11px] text-red-400">{archiveError}</p>}
      </form>

      {/* RSS / Podcast Feed Loader */}
      <form
        onSubmit={handleFeedSubmit}
        className="p-5 mb-4 space-y-2 border rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md"
      >
        <span className="text-xs font-mono uppercase tracking-widest text-white/70">Load from RSS / Podcast Feed</span>
        <div className="flex gap-2">
          <input
            value={feedInput}
            onChange={(e) => setFeedInput(e.target.value)}
            placeholder="Podcast RSS feed URL or a direct .mp3 link"
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400/50"
          />
          <button
            type="submit"
            disabled={feedLoading || !feedInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide rounded bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 transition"
          >
            {feedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {feedLoading ? 'Loading…' : 'Add to Catalog'}
          </button>
        </div>
        {feedError && <p className="text-[11px] text-red-400">{feedError}</p>}
      </form>

      <div className="p-5 space-y-4 border rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 border rounded-lg shrink-0 bg-cyan-500/10 border-cyan-500/30">
            {currentTrack?.mediaType === 'video' ? (
              <Film className="w-5 h-5 text-cyan-300" />
            ) : (
              <Music className="w-5 h-5 text-cyan-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentTrack?.title ?? 'Nothing loaded yet'}</p>
            <p className="text-xs truncate text-slate-500">
              {currentTrack?.artist ?? 'Load an Internet Archive item above to begin'}
            </p>
          </div>
        </div>

        {/* Video Mode: an embedded <video> viewport replaces the waveform
            entirely for video files. Audio Mode (default): Wavesurfer's
            waveform, as before. The waveform container stays mounted
            (just hidden) rather than conditionally rendered, since
            Wavesurfer is created once against that node in the effect
            above and can't reattach to a node that unmounts. */}
        <video
          key={currentTrack?.mediaType === 'video' ? currentTrack.id : 'no-video'}
          ref={videoRef}
          src={currentTrack?.mediaType === 'video' ? currentTrack.url : undefined}
          controls
          autoPlay
          onLoadedMetadata={(e) => {
            e.currentTarget.volume = volume;
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className={`w-full rounded-xl border border-cyan-500/20 bg-black ${
            currentTrack?.mediaType === 'video' ? 'block' : 'hidden'
          }`}
          style={{ maxHeight: 360 }}
        />
        <div
          ref={waveformRef}
          className={`w-full overflow-hidden border rounded-xl border-cyan-500/20 bg-black/40 ${
            currentTrack?.mediaType === 'video' ? 'hidden' : 'block'
          }`}
          style={{ minHeight: 72 }}
        />
        {currentTrack?.mediaType !== 'video' && !waveformReady && (
          <p className="text-[11px] text-slate-600">
            {currentTrack ? 'Loading waveform…' : 'Waveform appears once a track is loaded.'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={skipPrev}
            disabled={catalog.length === 0}
            className="flex items-center justify-center w-8 h-8 transition rounded-full text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-30"
            aria-label="Previous track"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlayPause}
            disabled={catalog.length === 0}
            className="flex items-center justify-center w-10 h-10 transition border border-cyan-400 rounded-full bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-30"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={skipNext}
            disabled={catalog.length === 0}
            className="flex items-center justify-center w-8 h-8 transition rounded-full text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-30"
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <div className="flex items-center flex-1 min-w-0 gap-2">
            <Volume2 className="w-4 h-4 shrink-0 text-slate-500" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full accent-cyan-400"
              aria-label="Volume"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-cyan-500/10">
          {!webampOpen ? (
            <button
              onClick={launchWebamp}
              className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition"
            >
              Launch Webamp
            </button>
          ) : (
            <button
              onClick={closeWebamp}
              className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
            >
              Close Webamp
            </button>
          )}
          {webampError && <p className="mt-2 text-[11px] text-red-400">{webampError}</p>}
        </div>
      </div>

      {/* Custom Media Catalog */}
      <div className="p-5 mt-4 border rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md">
        <span className="text-xs font-mono uppercase tracking-widest text-white/70">Your Catalog</span>
        {catalog.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Nothing imported yet — load an Internet Archive item above to start building your library.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {catalog.map((track, index) => {
              const isActive = index === currentIndex;
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-2 p-2 rounded-lg transition ${
                    isActive ? 'bg-cyan-500/10 border border-cyan-500/40' : 'bg-black/20 border border-transparent hover:border-slate-700'
                  }`}
                >
                  <button
                    onClick={() => playCatalogIndex(index)}
                    className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-cyan-300 hover:bg-cyan-500/20 transition"
                    aria-label={`Play ${track.title}`}
                  >
                    {isActive && isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {renamingId === track.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && commitRename(track.id)}
                          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-black/40 border border-cyan-500/40 rounded text-slate-100 outline-none"
                        />
                        <button
                          onClick={() => commitRename(track.id)}
                          className="text-cyan-300 shrink-0"
                          aria-label="Save name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">{track.title}</p>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded ${
                              track.mediaType === 'video'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {track.mediaType === 'video' ? '[VIDEO]' : '[AUDIO]'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{track.artist}</p>
                      </>
                    )}
                  </div>
                  {renamingId !== track.id && (
                    <button
                      onClick={() => startRename(track)}
                      className="flex items-center justify-center w-6 h-6 rounded shrink-0 text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition"
                      aria-label={`Rename ${track.title}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {/* Audio -> Radio Central, video -> Studio One — not both
                      on every row. Dispatch target is gated on the track's
                      own mediaType, not the icon/handler, which are unchanged. */}
                  {track.mediaType === 'audio' && (
                    <button
                      onClick={() => sendToRadioCentral(track)}
                      className="flex items-center justify-center w-6 h-6 rounded shrink-0 text-slate-500 hover:text-amber-300 hover:bg-amber-500/10 transition"
                      aria-label={`Send ${track.title} to Radio Central`}
                      title="Send to Radio Central"
                    >
                      <Radio className="w-3 h-3" />
                    </button>
                  )}
                  {track.mediaType === 'video' && onSendToStudioOne && (
                    <button
                      onClick={() =>
                        onSendToStudioOne({
                          title: track.title,
                          artist: track.artist,
                          url: track.url,
                          mediaType: track.mediaType,
                        })
                      }
                      className="flex items-center justify-center w-6 h-6 rounded shrink-0 text-slate-500 hover:text-violet-300 hover:bg-violet-500/10 transition"
                      aria-label={`Send ${track.title} to Studio One`}
                      title="Send to Studio One"
                    >
                      <Mic className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => removeCatalogItem(track.id)}
                    className="flex items-center justify-center w-6 h-6 rounded shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    aria-label={`Remove ${track.title}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Webamp mounts its own fixed-position skinned window into this node
          once rendered — the node itself has no visible box. */}
      <div ref={webampContainerRef} />
    </div>
  );
}
