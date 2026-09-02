'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Camera, Trash2, Home } from 'lucide-react';
import CosmicVisualizer from './CosmicVisualizer';
import StudioOneConsole from './StudioOneConsole';
import EqOrb from './EqOrb';
import { useRadioPlayer } from './radio/RadioPlayerContext';
import { extractIdentifier, buildArchiveEmbedUrl } from '@/lib/archiveOrg';
// Shared with StarTrackerView's own YT.Player mount (Sky Fest's Space
// Media tab) — see that file for why this lives in one place.
import type { YouTubePlayer, YouTubePlayerEvent } from '@/lib/youtubeIframeApi';
// Track/INITIAL_TRACKS live in lib/podsTracks.ts, shared with
// HomeBroadcastPanel (a read-only feed of this same track list on the Home
// tab) — this file's own behavior/localStorage handling is unchanged.
import { INITIAL_TRACKS, type Track } from '@/lib/podsTracks';

interface Playlist {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
}

type PlaybackMode = 'autoplay' | 'random' | 'loop';

const DEFAULT_PLAYLISTS: Playlist[] = [
  { id: 'all', name: 'All Tracks', description: 'Master stream feed' },
  { id: 'pods', name: 'Pods', description: 'Main Podcast & Cosmic Lore Streams' },
  { id: 'main-playlist', name: 'Playlist', description: 'User Custom Media & Audio' },
];

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Single source of truth for turning ANY YouTube URL a user might paste —
// a youtu.be short link, a standard watch link, a playlist link, or this
// app's own internal "https://www.youtube.com/embed/ID?list=..." format —
// into a clean videoId/listId pair, and back into that internal embed URL.
// Deliberately extracts videoId and listId independently rather than
// branching on "does it contain list=?" first: a link like
// "https://youtu.be/n2F24fK1uLY?list=PLxxxx" carries both a specific video
// AND its playlist context, and checking for list= first (the previous
// bug here) silently discarded the video id, always jumping to the first
// item in the playlist instead of the one actually linked.
function parseYouTubeUrl(rawUrl: string): {
  videoId?: string;
  listId?: string;
  autoplay: boolean;
  isPlaylistOnly: boolean;
  embedUrl: string;
} {
  let videoId: string | undefined;
  let listId: string | undefined;
  let autoplay = false;

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\.|^m\./, '');
    listId = url.searchParams.get('list') || undefined;
    autoplay = url.searchParams.get('autoplay') === '1';

    if (host === 'youtu.be') {
      videoId = url.pathname.slice(1).split('/')[0] || undefined;
    } else if (host === 'youtube.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') || undefined;
      } else if (url.pathname.startsWith('/embed/')) {
        const embedId = url.pathname.match(/\/embed\/([\w-]+)/)?.[1];
        if (embedId && embedId !== 'videoseries') videoId = embedId;
      }
      // '/playlist' (and any other youtube.com path) has no specific video
      // — falls through with only listId (if present) set.
    }
  } catch {
    // Not a parseable absolute URL — videoId/listId stay unset, and the
    // caller's embedUrl fallback below treats it as a direct media link.
  }

  const isPlaylistOnly = !videoId && !!listId;
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}${listId ? `?list=${listId}` : ''}`
    : listId
      ? `https://www.youtube.com/embed/videoseries?list=${listId}`
      : rawUrl;

  return { videoId, listId, autoplay, isPlaylistOnly, embedUrl };
}

interface PodsModuleProps {
  // False whenever app/page.tsx's activeTab isn't 'pods'. PodsModule stays
  // mounted (not conditionally rendered) even when inactive, so local
  // uploads' in-memory blob URLs survive tab switches — this prop is how it
  // knows to actually pause playback instead, rather than fully unmounting
  // (which would kill those blob URLs and lose in-progress uploads).
  isActive: boolean;
  // Optional — only passed from the Hub-mode call site (app/page.tsx),
  // not the Stack-mode one, since "go home" doesn't mean anything in a
  // single continuous-scroll layout. Studio One had no way back to Ai
  // One on mobile (LeftNav's own Home icon lives in a sidebar that's
  // hidden/collapsed there) - same fix as KaliOracleView's onGoHome.
  onGoHome?: () => void;
  // Set by app/page.tsx when a Media Flow catalog track is sent here via
  // "Send to Studio One" — PodsModule has no shared context of its own
  // (unlike Radio Central's RadioPlayerContext), so this one piece of
  // state is lifted to the nearest common ancestor instead of standing up
  // a whole new context for a single hand-off interaction. Cleared via
  // onPendingTrackConsumed once applied, so it can't get re-applied on an
  // unrelated re-render.
  pendingTrack?: StudioOneHandoffTrack | null;
  onPendingTrackConsumed?: () => void;
}

// Payload shape for the Media Flow -> Studio One hand-off — deliberately
// smaller than the full Track interface below (title/artist/url/mediaType
// only), since that's all a sending component can know about its own track.
export interface StudioOneHandoffTrack {
  title: string;
  artist: string;
  url: string;
  mediaType: 'audio' | 'video';
}

// Master Studio Audio Rack — a real vertical peak-level (VU) meter driven
// by one channel's AnalyserNode (leftAnalyserRef/rightAnalyserRef above,
// tapped post-panner in initAudioContext). Reads real time-domain data via
// its own requestAnimationFrame loop, same pattern as CosmicVisualizer's
// canvas — no synthetic/fake movement when nothing's playing, the bar
// just sits at 0.
//
// Takes the ref object itself, not analyserRef.current — the analyser
// doesn't exist yet on first mount (initAudioContext only creates it once
// the user actually presses play, a real user-gesture requirement, same
// as CosmicVisualizer/RadioPlayerContext elsewhere in this app), and refs
// don't trigger a re-render when they're filled in later. Reading
// .current fresh inside the loop itself means it picks up the real
// analyser the instant it exists, with no dependency on some other state
// change happening to cause a re-render at the right moment.
function VuMeter({ analyserRef, label }: { analyserRef: React.RefObject<AnalyserNode | null>; label: string }) {
  const [level, setLevel] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const data = new Uint8Array(256);
    function tick() {
      frameRef.current = requestAnimationFrame(tick);
      const analyser = analyserRef.current;
      if (!analyser) {
        setLevel(0);
        return;
      }
      analyser.getByteTimeDomainData(data);
      // Peak absolute deviation from the silence midpoint (128), not RMS -
      // a VU meter reads peaks, and this stays cheap enough to run every
      // frame without its own averaging window.
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const dev = Math.abs(data[i] - 128);
        if (dev > peak) peak = dev;
      }
      setLevel(Math.min(1, peak / 128));
    }
    tick();
    return () => cancelAnimationFrame(frameRef.current);
  }, [analyserRef]);

  return (
    <div className="flex flex-col items-center gap-1 w-6 shrink-0">
      <div className="relative w-2 h-24 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
        <div
          className="absolute bottom-0 w-full transition-[height] duration-75 ease-out rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
          style={{ height: `${(level * 100).toFixed(1)}%` }}
        />
      </div>
      <span className="text-[9px] font-mono text-slate-500">{label}</span>
    </div>
  );
}

export default function PodsModule({ isActive, onGoHome, pendingTrack, onPendingTrackConsumed }: PodsModuleProps) {
  // Global audio priority — see RadioPlayerContext's document-level 'play'
  // listener for native <video>/<audio> (covers this file's local-upload
  // and direct-URL video, and the Vault-track <audio> element, with no
  // extra code needed here). The YouTube IFrame Player below lives in a
  // cross-origin iframe, so it can't fire a DOM event the parent page can
  // observe — its own onStateChange has to push the signal through
  // explicitly instead, which is what this call does.
  const { pauseForExternalMedia } = useRadioPlayer();
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('pods');
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('autoplay');

  // Timers & Audio State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Drag & Drop / EQ Visibility
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [showEq, setShowEq] = useState<boolean>(true);

  // Camera / Simulcast Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Broadcast Monitor layout — 'full' preserves the original single-frame
  // behavior exactly (mutually-exclusive priority: local video > embed >
  // camera). 'split' shows the real Pod Cam feed (left) and whatever real
  // media/YouTube embed is loaded (right) side by side - not a fake
  // "guest" stream, the same real embed 'full' mode already has, just
  // repositioned. 'media' shows just the embed, full width, camera hidden.
  const [monitorLayout, setMonitorLayout] = useState<'full' | 'split' | 'media'>('full');

  // PodCam motion detection — cheap frame-differencing (draws each frame to
  // a tiny hidden canvas, compares total pixel delta against the previous
  // frame) rather than real gesture/hand-tracking ML, which would need a
  // trained model this app doesn't have. Only runs once the camera is
  // already on (never requests access on its own), triggers "next track" on
  // a detected motion spike, with a cooldown so one wave doesn't skip five
  // tracks.
  const [motionFlash, setMotionFlash] = useState(false);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const motionCooldownRef = useRef(false);

  // Zero-gravity unfold — replays a CSS 3D-transform entrance animation each
  // time Pods becomes the active tab (not just on first mount), by bumping a
  // key that remounts the animated wrapper.
  const [unfoldKey, setUnfoldKey] = useState(0);
  const wasActiveRef = useRef(isActive);

  // Custom Video/Playlist Embed State
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string>('');
  const [localVideoUrl, setLocalVideoUrl] = useState<string>('');
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  // Shared between the local-upload and direct-mp4/webm-embed <video>
  // elements — only one of those two branches is ever rendered at a time,
  // so a single ref safely tracks whichever is actually mounted.
  const broadcastVideoRef = useRef<HTMLVideoElement | null>(null);

  // Live Microphone Input — a real getUserMedia() capture mixed into the
  // exact same EQ/compressor/panner/VU-meter chain the track audio already
  // runs through (see startMic below: micGain connects straight into
  // filtersRef.current['60'], the same first filter node.connect(source)
  // already feeds into). Device labels from enumerateDevices() are empty
  // strings until mic permission has actually been granted once — that's
  // a real browser privacy behavior, not a bug in the dropdown.
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [micActive, setMicActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [micGainPct, setMicGainPct] = useState(80);
  const [micError, setMicError] = useState('');
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);

  // EQ Audio Nodes
  const [eqGains, setEqGains] = useState<{ [freq: string]: number }>({
    '60': 0,
    '250': 2,
    '1000': 0,
    '4000': 1,
    '12000': 3,
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<{ [freq: string]: BiquadFilterNode }>({});
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Real per-channel VU meters — a ChannelSplitterNode tapped off the same
  // post-panner point as analyserRef above (a parallel fan-out, not part of
  // the audible signal path itself; splitter isn't connected to
  // ctx.destination), so this reads the exact same fully-processed stereo
  // signal without altering what's heard.
  const leftAnalyserRef = useRef<AnalyserNode | null>(null);
  const rightAnalyserRef = useRef<AnalyserNode | null>(null);

  // Orb EQ control — a draggable alternative to the 5-band sliders, same
  // underlying BiquadFilterNodes. Stereo pan width is real too: a
  // StereoPannerNode whose pan is driven by a slow LFO (oscillatorRef ->
  // panLfoGainRef -> pannerRef.pan), with panLfoGainRef's gain set to the
  // orb's radial distance (0 = static center, 1 = full sweep). This is
  // ordinary Web Audio stereo panning, not licensed Dolby spatial audio —
  // no SDK for that exists here, so it's never claimed as such.
  const [eqControlMode, setEqControlMode] = useState<'sliders' | 'orb'>('sliders');
  const [panWidthPct, setPanWidthPct] = useState<number>(0);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const panLfoGainRef = useRef<GainNode | null>(null);

  // Dedicated full-view switch (player vs. cosmic visualizer) — not a modal,
  // so audio stays mounted and playing underneath while visualizer is active.
  const [activeView, setActiveView] = useState<'player' | 'visualizer'>('player');

  // Output Monitor: master volume + a real DynamicsCompressorNode for
  // broadcast-style loudness mastering. No spatial/surround processing —
  // Web Audio API doesn't decode or pass through real multichannel Dolby
  // bitstreams, so this only ever claims to do what it actually does.
  const [showOutputMonitor, setShowOutputMonitor] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(100);
  // Mirrors masterVolume for the YT onReady closure below, which is set up
  // inside an effect keyed on [isYouTubeEmbed, activeEmbedUrl] — not
  // masterVolume — so a plain closure over the state would go stale the
  // moment the console's volume changes without a new video also loading.
  const masterVolumeRef = useRef(masterVolume);
  const [masteringPreset, setMasteringPreset] = useState<'flat' | 'broadcast'>('flat');
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  // Modals & Notifications
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [addPlaylistUrl, setAddPlaylistUrl] = useState('');
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Skips the auto-save effect's own first invocation on mount, since at that
  // point it would still see default state — the restore effect's setTracks/
  // setPlaylists calls haven't applied to a render yet, only been queued.
  const isFirstAutoSaveRef = useRef(true);

  // File Processing
  const processAudioFiles = (files: FileList | File[]) => {
    const targetPlaylist = activePlaylistId === 'all' ? 'main-playlist' : activePlaylistId;
    const newTracks: Track[] = Array.from(files).map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      frequency: 'User Stream',
      description: `Local Audio • ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      src: URL.createObjectURL(file),
      playlistId: targetPlaylist,
      isLocal: true,
      contentToRead: `### Loaded File: ${file.name}\n\n* **Type:** ${file.type || 'Audio Media'}\n* **Size:** ${(file.size / (1024 * 1024)).toFixed(2)} MB`
    }));

    setTracks((prev) => [...newTracks, ...prev]);
    // Clear whatever was in the Broadcast Monitor (a video-backed track can
    // still be active from before) so the uploaded audio actually takes over
    // the monitor frame instead of leaving a stale video/iframe in front of it.
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl('');
    setActiveEmbedUrl('');
    setMediaUrl('');
    setActiveTrack(newTracks[0]);
    setIsPlaying(true);
  };

  // Drag and Drop Event Handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) {
      processAudioFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  // Close the overflow menu on outside click
  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverflowMenu]);

  // Persistence Effects (Sanitize Local Storage Blob References)
  useEffect(() => {
    const savedPlaylists = localStorage.getItem('aione_playlists_v2');
    const savedTracks = localStorage.getItem('aione_tracks_v2');
    if (savedPlaylists) {
      try { setPlaylists(JSON.parse(savedPlaylists)); } catch (err) { console.error(err); }
    }
    if (savedTracks) {
      try {
        const parsed: Track[] = JSON.parse(savedTracks);
        // Clean out invalid blobs from previous browser sessions
        const validTracks = parsed.filter(t => !t.isLocal || t.src.startsWith('http'));
        if (validTracks.length > 0) {
          setTracks(validTracks);
          setActiveTrack(validTracks[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Keep the Broadcast Monitor in sync with the active track whenever it's video-backed
  // (covers initial mount and localStorage restore, not just clicks handled by selectTrack).
  // Gated on isActive: Pods stays mounted (hidden) even on other tabs, and
  // without this gate this effect would set activeEmbedUrl the instant the
  // app loads — regardless of which tab is showing — which in turn
  // constructs the YouTube IFrame Player (script injection, real iframe,
  // network requests) for a view the user hasn't even opened yet.
  useEffect(() => {
    if (!isActive) return;
    if (activeTrack?.embedUrl) {
      setMediaUrl(activeTrack.watchUrl || '');
      setActiveEmbedUrl(activeTrack.embedUrl);
    }
  }, [activeTrack, isActive]);

  const triggerSave = () => {
    // Exclude ephemeral blob URLs when persisting state to localStorage
    const storableTracks = tracks.filter(t => !t.isLocal);
    localStorage.setItem('aione_playlists_v2', JSON.stringify(playlists));
    localStorage.setItem('aione_tracks_v2', JSON.stringify(storableTracks));
    setSaveStatus('SESSION SAVED');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  const exportSessionFile = () => {
    const sessionData = {
      playlists,
      tracks: tracks.filter(t => !t.isLocal),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aione-session-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaveStatus('FILE DOWNLOADED');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  useEffect(() => {
    // Skip the first pass — at mount time this still sees default state,
    // since the restore effect's setTracks/setPlaylists calls above are only
    // queued, not yet applied to a render, when this first runs.
    if (isFirstAutoSaveRef.current) {
      isFirstAutoSaveRef.current = false;
      return;
    }
    const storableTracks = tracks.filter(t => !t.isLocal);
    localStorage.setItem('aione_playlists_v2', JSON.stringify(playlists));
    localStorage.setItem('aione_tracks_v2', JSON.stringify(storableTracks));
  }, [playlists, tracks]);

  // Audio Context & Equalizer
  const initAudioContext = () => {
    if (!audioCtxRef.current && audioRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(audioRef.current);
      const frequencies = ['60', '250', '1000', '4000', '12000'];
      let lastNode: AudioNode = source;

      frequencies.forEach((freq, idx) => {
        const filter = ctx.createBiquadFilter();
        if (idx === 0) filter.type = 'lowshelf';
        else if (idx === frequencies.length - 1) filter.type = 'highshelf';
        else filter.type = 'peaking';

        filter.frequency.value = parseInt(freq);
        filter.gain.value = eqGains[freq] || 0;
        filtersRef.current[freq] = filter;

        lastNode.connect(filter);
        lastNode = filter;
      });

      const compressor = ctx.createDynamicsCompressor();
      applyCompressorValues(compressor, masteringPreset);
      compressorRef.current = compressor;
      lastNode.connect(compressor);

      // Stereo pan width (the Orb EQ's radial-distance control): a real
      // StereoPannerNode swept by a slow LFO. The LFO's own gain node is
      // what the orb actually drives — 0 width means the LFO contributes
      // nothing and pan stays dead center; 1 means a full -1..1 sweep.
      const panner = ctx.createStereoPanner();
      pannerRef.current = panner;
      compressor.connect(panner);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15; // slow, ~6.7s per cycle
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0; // orb starts centered — no sweep until dragged
      panLfoGainRef.current = lfoGain;
      lfo.connect(lfoGain);
      lfoGain.connect(panner.pan);
      lfo.start();

      // Visualizer tap: sits after the panner so the CosmicVisualizer canvas
      // reads the fully-processed signal without altering what's heard.
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;
      panner.connect(analyser);
      analyser.connect(ctx.destination);

      // Master Studio Audio Rack — real L/R VU meters. Splits the same
      // post-panner stereo signal into two mono channels; each gets its own
      // small analyser (fftSize 256 is plenty for a peak-level readout, no
      // need for the frequency resolution a spectrum view would want).
      // Deliberately NOT connected onward to ctx.destination — this splitter
      // is a pure analysis tap, not part of what's actually heard.
      const vuSplitter = ctx.createChannelSplitter(2);
      panner.connect(vuSplitter);

      const leftAnalyser = ctx.createAnalyser();
      leftAnalyser.fftSize = 256;
      vuSplitter.connect(leftAnalyser, 0);
      leftAnalyserRef.current = leftAnalyser;

      const rightAnalyser = ctx.createAnalyser();
      rightAnalyser.fftSize = 256;
      vuSplitter.connect(rightAnalyser, 1);
      rightAnalyserRef.current = rightAnalyser;
    }
  };

  // Live Mic Input — enumerateDevices() only returns real device labels
  // (e.g. "Focusrite Scarlett 2i2") once mic permission has actually been
  // granted at least once; before that every label is an empty string, by
  // design, for privacy (a page could otherwise fingerprint hardware
  // without ever asking). Requesting a throwaway stream just to populate
  // labels, then immediately stopping it, is the standard way around that
  // — this is a real user gesture (the button that calls this), not
  // something that runs unprompted on mount.
  const refreshAudioInputDevices = async () => {
    setMicError('');
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput'));
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Could not access audio input devices.');
    }
  };

  // Bare enumerateDevices() on mount — unlike refreshAudioInputDevices
  // above, this never calls getUserMedia and can never itself trigger a
  // permission prompt or throw for lack of permission (that's not how
  // enumerateDevices works: it always resolves, just with blank labels
  // pre-permission). If this site was already granted mic access on a
  // previous visit, the browser remembers that at the origin level, so
  // real labels (and a real Focusrite/etc. match) show up immediately
  // with zero clicks. Deliberately does NOT call startMic() itself —
  // auto-selecting a default in the dropdown is safe UI state; silently
  // starting real microphone capture with no explicit click is a real,
  // separate, more invasive behavior this doesn't take on unprompted.
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      if (inputs.length === 0) return;
      setAudioInputDevices(inputs);
      setMicError('');
      setSelectedMicId((prev) => {
        if (prev) return prev; // don't clobber a choice the user already made
        const focusrite = inputs.find((d) => d.label.toLowerCase().includes('focusrite'));
        return (focusrite ?? inputs[0]).deviceId;
      });
    }).catch(() => {
      // Not supported in this context (e.g. insecure origin) — leave the
      // dropdown's own "Click to list input devices…" placeholder as-is.
    });
  }, []);

  // Starts (or restarts, if switching devices) live mic capture and mixes
  // it into the exact same processing chain the track audio already runs
  // through — micGain connects straight into filtersRef.current['60'],
  // the same first EQ filter node.connect(source) already feeds into, so
  // both signals pass through the same 5-band EQ/compressor/panner and
  // show up on the same L/R VU meters. initAudioContext() is idempotent
  // (checks !audioCtxRef.current before doing anything) and safe to call
  // here even if no track has ever played — the mic shouldn't require
  // one just to exist.
  const startMic = async (deviceId: string) => {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });

      // Permission is now confirmed granted (the call above didn't throw),
      // so labels are real — populate the dropdown here too, not just via
      // the separate Refresh Devices path, so clicking Enable Mic directly
      // (without ever touching Refresh/the dropdown first) still ends up
      // with a populated device list, not an empty one.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput'));
      } catch {
        // Non-fatal — the mic itself is already running at this point;
        // only the dropdown's list would stay stale.
      }

      initAudioContext();
      const ctx = audioCtxRef.current;
      const firstFilter = filtersRef.current['60'];
      if (!ctx || !firstFilter) {
        stream.getTracks().forEach((t) => t.stop());
        setMicError('Audio engine not ready — try again.');
        return;
      }

      // Tear down any previous mic connection first (switching devices).
      micSourceRef.current?.disconnect();
      micGainNodeRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());

      const micSource = ctx.createMediaStreamSource(stream);
      const micGain = ctx.createGain();
      micGain.gain.value = micMuted ? 0 : micGainPct / 100;
      micSource.connect(micGain);
      micGain.connect(firstFilter);

      micStreamRef.current = stream;
      micSourceRef.current = micSource;
      micGainNodeRef.current = micGain;
      // The real resolved device, not just whatever was requested — an
      // empty/no-constraint request (deviceId === '') still lands on one
      // specific real interface, and the dropdown should reflect that
      // actual choice rather than staying on "Default microphone".
      const resolvedDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? deviceId;
      setSelectedMicId(resolvedDeviceId);
      setMicActive(true);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Could not start the microphone.');
    }
  };

  const stopMic = () => {
    micSourceRef.current?.disconnect();
    micGainNodeRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micSourceRef.current = null;
    micGainNodeRef.current = null;
    setMicActive(false);
  };

  // Live gain/mute — ramped with setTargetAtTime (matching setPanWidth's
  // own approach elsewhere in this file) rather than an instant jump, so
  // toggling mute or dragging the slider doesn't click/pop.
  useEffect(() => {
    if (micGainNodeRef.current && audioCtxRef.current) {
      const target = micMuted ? 0 : micGainPct / 100;
      micGainNodeRef.current.gain.setTargetAtTime(target, audioCtxRef.current.currentTime, 0.05);
    }
  }, [micGainPct, micMuted]);

  // Stop the mic (real hardware, real OS-level indicator light) if this
  // component ever unmounts while it's live — same cleanup discipline as
  // the camera's own stream teardown elsewhere in this file.
  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function applyCompressorValues(compressor: DynamicsCompressorNode, mode: 'flat' | 'broadcast') {
    const t = compressor.context.currentTime;
    if (mode === 'broadcast') {
      // Dense broadcast/radio-style loudness limiting
      compressor.threshold.setValueAtTime(-24, t);
      compressor.knee.setValueAtTime(30, t);
      compressor.ratio.setValueAtTime(12, t);
      compressor.attack.setValueAtTime(0.003, t);
      compressor.release.setValueAtTime(0.25, t);
    } else {
      // Gentle safety limiting only — near-transparent
      compressor.threshold.setValueAtTime(-12, t);
      compressor.knee.setValueAtTime(6, t);
      compressor.ratio.setValueAtTime(2, t);
      compressor.attack.setValueAtTime(0.02, t);
      compressor.release.setValueAtTime(0.3, t);
    }
  }

  const applyMasteringPreset = (mode: 'flat' | 'broadcast') => {
    setMasteringPreset(mode);
    if (compressorRef.current) {
      applyCompressorValues(compressorRef.current, mode);
    }
  };

  // Shared by the classic slider and the Orb — one real code path for
  // both. Sets audioRef.current.volume (0-1) for native audio/video tracks
  // AND, when the active track is a YouTube embed, the real IFrame Player
  // setVolume(0-100) — a separate call because Web Audio gain nodes can't
  // reach into a cross-origin YouTube iframe at all, so there's no way to
  // route both through one shared audio graph.
  const setMasterVolumeValue = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setMasterVolume(clamped);
    masterVolumeRef.current = clamped;
    if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
    }
    if (ytPlayerReadyRef.current) {
      ytPlayerRef.current?.setVolume(clamped);
    }
  };

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMasterVolumeValue(parseFloat(e.target.value));
  };

  const handleEqChange = (freq: string, gain: number) => {
    setEqGains((prev) => ({ ...prev, [freq]: gain }));
    if (filtersRef.current[freq]) {
      filtersRef.current[freq].gain.value = gain;
    }
  };

  const handleOrbBassTreble = useCallback((bassGain: number, trebleGain: number) => {
    handleEqChange('60', bassGain);
    handleEqChange('12000', trebleGain);
  }, []);

  const handleOrbPanWidth = useCallback((width: number) => {
    setPanWidthPct(Math.round(width * 100));
    if (panLfoGainRef.current && audioCtxRef.current) {
      panLfoGainRef.current.gain.setTargetAtTime(width, audioCtxRef.current.currentTime, 0.05);
    }
  }, []);

  const applyPreset = (preset: 'flat' | 'warm432' | 'vocal' | 'bass') => {
    let gains = { '60': 0, '250': 0, '1000': 0, '4000': 0, '12000': 0 };
    if (preset === 'warm432') gains = { '60': 3, '250': 4, '1000': 1, '4000': -1, '12000': 2 };
    if (preset === 'vocal') gains = { '60': -2, '250': 1, '1000': 4, '4000': 3, '12000': 1 };
    if (preset === 'bass') gains = { '60': 6, '250': 4, '1000': 0, '4000': 0, '12000': -1 };

    setEqGains(gains);
    Object.keys(gains).forEach((freq) => {
      if (filtersRef.current[freq]) {
        filtersRef.current[freq].gain.value = gains[freq as keyof typeof gains];
      }
    });
  };

  // Playback Control
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, activeTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  // YouTube IFrame Player API bridge — the only way to read currentTime out
  // of a YouTube embed, since a plain <iframe src=...> is cross-origin and
  // exposes nothing. isYouTubeEmbed is intentionally NOT keyed on
  // activeEmbedUrl's exact value, so the player container (and the YT.Player
  // instance bound to it) survives switching between YouTube tracks —
  // switching videos calls loadVideoById/loadPlaylist on the existing
  // player rather than tearing down and recreating it.
  const isYouTubeEmbed =
    !!activeEmbedUrl &&
    !activeEmbedUrl.endsWith('.mp4') &&
    !activeEmbedUrl.endsWith('.webm') &&
    !activeEmbedUrl.includes('archive.org/embed/');
  // React renders and owns this wrapper, but never puts any JSX children
  // inside it — YT.Player replaces whatever element it's given with its own
  // <iframe>, entirely outside React's reconciliation. Handing it an id
  // that's part of React's own JSX output (as an earlier version of this
  // did) means React still believes it owns that node; the first re-render
  // after YT.Player has swapped it for an iframe then throws "Failed to
  // execute 'removeChild': the node to be removed is not a child of this
  // node" trying to clean up a node that's no longer where React left it.
  // Appending a plain, imperatively-created div (below) that React's JSX
  // never declared sidesteps this — React has zero expectations about that
  // node's presence, so it never tries to touch it.
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YouTubePlayer | null>(null);
  const ytPollIntervalRef = useRef<number | null>(null);
  // The Player object returned by `new YT.Player(...)` exists immediately,
  // but its methods (loadVideoById, getCurrentTime, ...) aren't attached
  // until the iframe finishes its own handshake and fires onReady — calling
  // them before that throws "is not a function". Dev-mode React Strict
  // Mode's double-invoked effects hit this reliably (bind, then immediately
  // bind again before the first one's ready), so any load requested before
  // onReady has to be queued rather than called directly.
  const ytPlayerReadyRef = useRef(false);
  const ytPendingLoadRef = useRef<{ videoId?: string; listId?: string } | null>(null);

  useEffect(() => {
    if (!isYouTubeEmbed) return;
    const { videoId, listId, autoplay } = parseYouTubeUrl(activeEmbedUrl);
    if (!videoId && !listId) return;

    const applyLoad = (target: { videoId?: string; listId?: string }) => {
      const player = ytPlayerRef.current;
      if (!player) return;
      if (target.videoId) player.loadVideoById(target.videoId);
      else if (target.listId) player.loadPlaylist({ list: target.listId });
    };

    const bindPlayer = () => {
      if (ytPlayerRef.current) {
        if (ytPlayerReadyRef.current) applyLoad({ videoId, listId });
        else ytPendingLoadRef.current = { videoId, listId };
        return;
      }
      if (!ytContainerRef.current) return;
      const playerHost = document.createElement('div');
      playerHost.style.width = '100%';
      playerHost.style.height = '100%';
      ytContainerRef.current.appendChild(playerHost);
      ytPlayerRef.current = new window.YT!.Player(playerHost, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          ...(listId ? { listType: 'playlist', list: listId } : {}),
        },
        events: {
          onReady: () => {
            ytPlayerReadyRef.current = true;
            // A freshly mounted player otherwise defaults to its own last
            // volume (usually 100), ignoring whatever the console's
            // Master Volume slider is already set to.
            ytPlayerRef.current?.setVolume(masterVolumeRef.current);
            if (ytPendingLoadRef.current) {
              const pending = ytPendingLoadRef.current;
              ytPendingLoadRef.current = null;
              applyLoad(pending);
            }
          },
          onStateChange: (event) => {
            if (ytPollIntervalRef.current !== null) {
              window.clearInterval(ytPollIntervalRef.current);
              ytPollIntervalRef.current = null;
            }
            // Poll while actually playing — the API has no native
            // timeupdate event, so this is the only way to feed
            // currentTime into the same state <audio>/<video> already use.
            if (event.data === window.YT!.PlayerState.PLAYING) {
              setIsPlaying(true);
              pauseForExternalMedia();
              ytPollIntervalRef.current = window.setInterval(() => {
                const player = ytPlayerRef.current;
                if (!player) return;
                setCurrentTime(player.getCurrentTime());
                setDuration(player.getDuration() || 0);
              }, 100);
            } else if (
              event.data === window.YT!.PlayerState.PAUSED ||
              event.data === window.YT!.PlayerState.ENDED
            ) {
              setIsPlaying(false);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      bindPlayer();
    } else {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        bindPlayer();
      };
      if (!document.getElementById('youtube-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }
  }, [isYouTubeEmbed, activeEmbedUrl]);

  // Tear the player down when leaving the YouTube branch entirely (switched
  // to plain video/audio, or cleared media) — and on unmount.
  useEffect(() => {
    if (isYouTubeEmbed) return;
    if (ytPollIntervalRef.current !== null) {
      window.clearInterval(ytPollIntervalRef.current);
      ytPollIntervalRef.current = null;
    }
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }
    // destroy() only removes the <iframe> itself, leaving the empty host
    // div (created imperatively in bindPlayer) behind — clear it out too so
    // a later bindPlayer call doesn't accumulate orphaned leftover divs
    // inside ytContainerRef across repeated open/close cycles.
    ytContainerRef.current?.replaceChildren();
    ytPlayerReadyRef.current = false;
    ytPendingLoadRef.current = null;
  }, [isYouTubeEmbed]);

  useEffect(() => {
    const container = ytContainerRef.current;
    return () => {
      if (ytPollIntervalRef.current !== null) window.clearInterval(ytPollIntervalRef.current);
      ytPlayerRef.current?.destroy();
      container?.replaceChildren();
    };
  }, []);

  // Pods stays mounted (not conditionally rendered) when its tab isn't
  // active, so blob-URL uploads survive tab switches — but that also means
  // nothing stops playback on its own when the user navigates away.
  // Without this, audio/video kept playing underneath Home/Radio/Vault.
  // Pauses rather than unmounting, so the pack/upload state is untouched
  // and playback simply resumes paused when the user comes back.
  useEffect(() => {
    if (isActive) return;
    // isPlaying itself updates via each element's own onPause/onStateChange
    // callback (below), not here — these just trigger the pause.
    audioRef.current?.pause();
    broadcastVideoRef.current?.pause();
    // pauseVideo (like loadVideoById/loadPlaylist above) isn't attached to
    // the Player object until its iframe handshake completes and onReady
    // fires — calling it before that throws "pauseVideo is not a function"
    // (verified against the real YouTube IFrame API, not assumed). Skipping
    // the call when not ready is fine here: there's nothing playing yet for
    // a not-ready player to pause.
    if (ytPlayerReadyRef.current) ytPlayerRef.current?.pauseVideo();
  }, [isActive]);

  // Zero-gravity unfold — replays the entrance animation on the false->true
  // transition (i.e. every time you actually navigate into Pods), not just
  // on first mount, since PodsModule stays mounted in the background.
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      setUnfoldKey((k) => k + 1);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Camera Toggle
  const toggleCamera = async () => {
    setCameraError('');
    if (isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
      } catch {
        setCameraError('Camera offline or blocked. Click the browser permissions icon near URL bar to unblock.');
        setIsCameraActive(false);
      }
    }
  };

  // PodCam motion detection — samples the live camera feed onto a tiny
  // (32x24) hidden canvas at ~6fps and compares total pixel delta against
  // the previous frame. A spike past MOTION_THRESHOLD (something moved
  // through frame — a wave, someone entering) triggers "next track", gated
  // by a 2s cooldown so one gesture doesn't cascade through the whole
  // playlist. This is real frame-differencing, not gesture/hand-tracking ML
  // — it can't tell a wave from someone walking past, only that something
  // changed a lot, all at once.
  useEffect(() => {
    if (!isCameraActive) {
      prevFrameRef.current = null;
      return;
    }

    const MOTION_THRESHOLD = 18; // avg per-pixel grayscale delta, 0-255 scale
    const SAMPLE_W = 32;
    const SAMPLE_H = 24;
    const canvas = motionCanvasRef.current;
    if (!canvas) return;
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
      const frame = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
      const prev = prevFrameRef.current;

      if (prev) {
        let diffSum = 0;
        const pixelCount = SAMPLE_W * SAMPLE_H;
        for (let i = 0; i < frame.length; i += 4) {
          // Cheap grayscale (average of RGB) rather than full luma weighting
          // — plenty accurate for "did something big just change".
          const g1 = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
          const g2 = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
          diffSum += Math.abs(g1 - g2);
        }
        const avgDiff = diffSum / pixelCount;

        if (avgDiff > MOTION_THRESHOLD && !motionCooldownRef.current) {
          motionCooldownRef.current = true;
          setMotionFlash(true);
          handleNextTrack();
          setTimeout(() => setMotionFlash(false), 1200);
          setTimeout(() => {
            motionCooldownRef.current = false;
          }, 2000);
        }
      }
      prevFrameRef.current = frame;
    }, 160);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraActive]);

  // Parse & load a custom YouTube video/playlist, Internet Archive item, or
  // direct media URL into the monitor.
  const loadMedia = () => {
    const input = mediaUrl.trim();
    if (!input) return;

    // Internet Archive: either a real archive.org URL, or a bare item id
    // (no "/" or ":") — the same bare-id assumption MediaFlowAudioCenter's
    // Internet Archive loader already makes, since this input's only other
    // legitimate use (YouTube URLs, direct media links) always contains one.
    const archiveId = extractIdentifier(input);
    const looksLikeArchiveUrl = /archive\.org/i.test(input);
    const looksLikeBareId = !/[/:]/.test(input);
    if (archiveId && (looksLikeArchiveUrl || looksLikeBareId)) {
      setActiveEmbedUrl(buildArchiveEmbedUrl(archiveId));
      return;
    }

    setActiveEmbedUrl(parseYouTubeUrl(input).embedUrl);
  };

  const clearMedia = () => {
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl('');
    setActiveEmbedUrl('');
    setMediaUrl('');
  };

  const handleLocalVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setActiveEmbedUrl('');
    setLocalVideoUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  // Selecting a track: routes video-backed tracks into the Broadcast Monitor,
  // and audio-backed tracks into the <audio> player, clearing the other each time.
  const selectTrack = useCallback((track: Track) => {
    setActiveTrack(track);
    if (track.embedUrl) {
      setIsPlaying(false);
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
      setLocalVideoUrl('');
      setMediaUrl(track.watchUrl || '');
      setActiveEmbedUrl(track.embedUrl);
    } else {
      setActiveEmbedUrl('');
      setMediaUrl('');
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
      setLocalVideoUrl('');
      setIsPlaying(true);
    }
  }, [localVideoUrl]);

  // "Send to Studio One" hand-off from Media Flow — mirrors handleAddPlaylist
  // below exactly (same Track field conventions: src holds the URL for audio,
  // embedUrl/watchUrl hold it for video, playlistId defaults to
  // 'main-playlist'), just sourced from a prop instead of a form submit.
  useEffect(() => {
    if (!pendingTrack) return;
    const isVideo = pendingTrack.mediaType === 'video';
    const newTrack: Track = {
      id: `media-flow-${Date.now()}`,
      title: pendingTrack.title,
      frequency: isVideo ? 'Media Flow Video' : 'Media Flow Audio',
      description: pendingTrack.artist,
      src: isVideo ? '' : pendingTrack.url,
      embedUrl: isVideo ? pendingTrack.url : undefined,
      watchUrl: isVideo ? pendingTrack.url : undefined,
      playlistId: 'main-playlist',
      contentToRead: `### ${pendingTrack.title}\n\nSent from Media Flow.`,
    };
    setTracks((prev) => [newTrack, ...prev]);
    setActivePlaylistId('main-playlist');
    selectTrack(newTrack);
    onPendingTrackConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTrack]);

  // useMemo (not a plain derived const) — filteredTracks feeds the
  // MediaSession effect below via handleNextTrack/handlePrevTrack. A fresh
  // array every render would give those callbacks a new identity every
  // render too, re-running that effect (which calls setActionHandler 4x)
  // on every one of PodsModule's frequent unrelated re-renders (100ms
  // YouTube polling, motion detection) instead of only when the track
  // list or active playlist actually changes.
  const filteredTracks = useMemo(
    () => (activePlaylistId === 'all' ? tracks : tracks.filter(t => t.playlistId === activePlaylistId)),
    [tracks, activePlaylistId]
  );

  const deleteTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation(); // don't let this also trigger the row's selectTrack click
    const target = tracks.find(t => t.id === trackId);
    if (target?.isLocal) {
      URL.revokeObjectURL(target.src); // free the blob now that nothing will reference it
    }

    setTracks(prev => prev.filter(t => t.id !== trackId));

    if (activeTrack?.id === trackId) {
      const remaining = filteredTracks.filter(t => t.id !== trackId);
      if (remaining.length > 0) {
        selectTrack(remaining[0]);
      }
    }
  };

  const handleTrackEnd = () => {
    if (filteredTracks.length === 0) return;
    if (playbackMode === 'loop') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (playbackMode === 'random') {
      const randomIndex = Math.floor(Math.random() * filteredTracks.length);
      selectTrack(filteredTracks[randomIndex]);
    } else {
      const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
      const nextIndex = (currentIndex + 1) % filteredTracks.length;
      selectTrack(filteredTracks[nextIndex]);
    }
  };

  const handleNextTrack = useCallback(() => {
    if (filteredTracks.length === 0) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
    selectTrack(filteredTracks[(currentIndex + 1) % filteredTracks.length]);
  }, [filteredTracks, activeTrack, selectTrack]);

  const handlePrevTrack = useCallback(() => {
    if (filteredTracks.length === 0) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
    selectTrack(filteredTracks[(currentIndex - 1 + filteredTracks.length) % filteredTracks.length]);
  }, [filteredTracks, activeTrack, selectTrack]);

  // Bluetooth / lock-screen media controls (Web MediaSession API).
  // Only applies to real <audio> playback — video tracks play inside a
  // cross-origin YouTube iframe, which handles its own Bluetooth/lock-screen
  // integration natively; we can't and shouldn't override that from here.
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (!activeTrack || activeTrack.embedUrl) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeTrack.title,
      artist: activeTrack.frequency,
      album: 'AIONE Cosmic HUD — Pods',
    });

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [activeTrack, handlePrevTrack, handleNextTrack]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || activeTrack?.embedUrl) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying, activeTrack]);

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      description: 'Custom user created playlist',
      isCustom: true
    };

    setPlaylists((prev) => [...prev, newPl]);
    setActivePlaylistId(newPl.id);
    setNewPlaylistName('');
    setShowCreateModal(false);
  };

  // Parse a pasted YouTube video/playlist URL (or direct media link) into a new Playlist track,
  // fetching the real title via YouTube's public oEmbed endpoint (no API key required).
  const handleImportPlaylistUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = addPlaylistUrl.trim();
    if (!url) return;
    setIsImportingPlaylist(true);

    const { embedUrl, isPlaylistOnly } = parseYouTubeUrl(url);

    let title = isPlaylistOnly ? 'YouTube Playlist' : 'Imported Media';
    let description = url;
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
        if (data.author_name) description = data.author_name;
      }
    } catch {
      // oEmbed can fail for playlist-only URLs or network issues — keep the fallback label
    }

    const newTrack: Track = {
      id: `playlist-${Date.now()}`,
      title,
      frequency: isPlaylistOnly ? 'YouTube Playlist' : 'YouTube Video',
      description,
      src: '',
      embedUrl,
      watchUrl: url,
      playlistId: 'main-playlist',
      contentToRead: `### ${title}\n\nImported from: ${url}`,
    };

    setTracks((prev) => [newTrack, ...prev]);
    setActivePlaylistId('main-playlist');
    selectTrack(newTrack);
    setAddPlaylistUrl('');
    setIsImportingPlaylist(false);
    setShowAddPlaylistModal(false);
  };

  const handleDeletePlaylist = (idToDelete: string) => {
    if (['all', 'pods', 'main-playlist'].includes(idToDelete)) return;

    const updatedTracks = tracks.filter(t => t.playlistId !== idToDelete);
    setPlaylists((prev) => prev.filter(p => p.id !== idToDelete));
    setTracks(updatedTracks);
    setActivePlaylistId('pods');

    // Fallback if current active track belonged to deleted playlist
    if (activeTrack?.playlistId === idToDelete) {
      if (updatedTracks.length > 0) {
        setActiveTrack(updatedTracks[0]);
      }
    }
  };

  const activePlaylistObj = playlists.find(p => p.id === activePlaylistId);

  return (
    <div
      key={unfoldKey}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative transition animate-zero-gravity-unfold ${
        isDraggingOver ? 'bg-white/10 border-2 border-dashed border-neutral-700 rounded-2xl' : ''
      }`}
      style={{ perspective: '1200px' }}
    >
      <style jsx>{`
        @keyframes zeroGravityUnfold {
          0% {
            opacity: 0;
            transform: rotateX(15deg) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg) scale(1);
          }
        }
        .animate-zero-gravity-unfold {
          transform-style: preserve-3d;
          animation: zeroGravityUnfold 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      <audio
        ref={audioRef}
        src={activeTrack?.src || undefined}
        onPlay={initAudioContext}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleTrackEnd}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) {
            processAudioFiles(e.target.files);
            setShowUploadModal(false);
          }
        }}
        accept="audio/*"
        multiple
        className="hidden"
      />

      {activeView === 'visualizer' && (
        <div className="w-full h-[75vh] rounded-2xl overflow-hidden border border-neutral-700">
          <CosmicVisualizer
            analyser={analyserRef.current}
            isPlaying={isPlaying && !activeTrack?.embedUrl}
            trackTitle={activeTrack?.title}
            onBack={() => setActiveView('player')}
          />
        </div>
      )}

      {activeView === 'player' && (
      <StudioOneConsole>
      {/* Header Bar — z-30 (not z-10) so its own overflow-menu popover
          (z-50 within this context) actually escapes above the Broadcast
          Monitor card's sibling z-10 stacking context, not just within
          this header's own. */}
      <div className="relative z-30 flex items-center justify-between min-h-[44px] gap-4 p-3 rounded-lg bg-[#1e2229] border border-slate-700/50">
        <div className="flex items-center gap-3 shrink-0">
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              aria-label="Home"
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </button>
          )}
          <h2 className="text-lg font-mono font-extrabold tracking-widest text-white uppercase whitespace-nowrap">
            STUDIO ONE
          </h2>
        </div>

        {/* Reserved banner slot — dormant for now, activated later */}
        <div className="flex items-center justify-center flex-1 h-8 border border-dashed rounded-md border-neutral-700 bg-white/[0.03]">
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/70">
            Banner Reserved
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveStatus && (
            <span className="text-[11px] font-mono text-emerald-400 animate-pulse bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded">
              {saveStatus}
            </span>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="h-8 px-3 text-[11px] font-mono uppercase tracking-wide transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            + Playlist
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="h-8 px-3 text-[11px] font-mono uppercase tracking-wide transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            + Upload
          </button>


          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setShowOverflowMenu((v) => !v)}
              className="flex items-center justify-center w-8 h-8 font-bold transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
              aria-label="More options"
              title="More options"
            >
              ⋮
            </button>

            {showOverflowMenu && (
              <div className="absolute right-0 z-50 py-1 mt-2 border rounded-md shadow-lg w-40 bg-slate-900 border-neutral-700">
                {[
                  { label: 'Load Link', action: loadMedia },
                  ...(activeEmbedUrl.includes('youtube.com')
                    ? [{ label: 'Open on YouTube', action: () => window.open(mediaUrl, '_blank', 'noopener,noreferrer') }]
                    : []),
                  { label: 'Download', action: exportSessionFile },
                  { label: 'Save', action: triggerSave },
                  { label: 'Save As', action: exportSessionFile },
                  { label: 'Save Session', action: triggerSave },
                  { label: 'Help', action: () => setShowHelpModal(true) },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      item.action();
                      setShowOverflowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Selector */}
      <div className="relative z-10 flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex gap-2 overflow-x-auto">
          {playlists.map((pl) => (
            <div key={pl.id} className="flex items-center gap-1">
              <button
                onClick={() => setActivePlaylistId(pl.id)}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition whitespace-nowrap ${
                  activePlaylistId === pl.id
                    ? 'bg-white/20 text-white border border-neutral-700'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {pl.name}
              </button>

              {pl.id === 'main-playlist' && (
                <>
                  <button
                    onClick={() => setShowAddPlaylistModal(true)}
                    title="Add a YouTube video or playlist link"
                    className="flex items-center justify-center w-6 h-6 font-bold transition border rounded-lg bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
                  >
                    +
                  </button>
                  <button
                    onClick={triggerSave}
                    title="Save Playlist"
                    className="flex items-center justify-center w-6 h-6 text-xs transition border rounded-lg bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
                  >
                    💾
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {activePlaylistObj?.isCustom && (
          <button
            onClick={() => handleDeletePlaylist(activePlaylistId)}
            className="px-3 py-1 ml-2 font-mono text-xs text-red-400 transition border rounded hover:text-red-300 bg-red-950/40 border-red-900/50 whitespace-nowrap"
          >
            DELETE PLAYLIST
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Left Column: Player & EQ */}
        <div className="space-y-4 lg:col-span-5">
          {activeTrack ? (
            <div className="bg-[#12141a] border-t-2 border-l-2 border-t-white/90 border-l-white/90 border-b-2 border-r-2 border-b-black border-r-black rounded-xl shadow-[-3px_-3px_10px_rgba(255,255,255,0.3),8px_8px_20px_rgba(0,0,0,0.75),inset_1px_1px_2px_rgba(255,255,255,0.2)] p-5 relative z-10 space-y-4 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-block px-2 py-0.5 bg-white/10 text-white text-xs font-mono rounded">
                  {activeTrack.frequency}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEq(!showEq)}
                    className={`px-2 py-1 border rounded text-xs font-mono transition ${
                      showEq
                        ? 'bg-white/20 border-neutral-700 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    EQ
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowOutputMonitor(!showOutputMonitor)}
                      title="Output Volume & Mastering"
                      className={`px-2 py-1 border rounded text-xs font-mono transition ${
                        showOutputMonitor || masteringPreset !== 'flat'
                          ? 'bg-white/20 border-neutral-700 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      VC
                    </button>

                    {showOutputMonitor && (
                      <div className="absolute left-0 z-50 p-4 mt-2 border shadow-2xl w-64 rounded-xl bg-slate-950 border-neutral-700">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-300">OUTPUT MONITOR</span>
                          <span className="text-white">{masterVolume}%</span>
                        </div>

                        <div className="mb-4">
                          <label className="block mb-1 text-slate-400">Master Volume</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={masterVolume}
                            onChange={handleMasterVolumeChange}
                            className="w-full h-1 rounded cursor-pointer accent-white bg-slate-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-slate-400">Mastering</label>
                          <button
                            onClick={() => applyMasteringPreset('broadcast')}
                            className={`w-full py-1.5 px-2 rounded text-left transition ${
                              masteringPreset === 'broadcast' ? 'bg-white/20 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            • Broadcast (dense limiting)
                          </button>
                          <button
                            onClick={() => applyMasteringPreset('flat')}
                            className={`w-full py-1.5 px-2 rounded text-left transition ${
                              masteringPreset === 'flat' ? 'bg-white/20 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            • Flat (near-transparent)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <select
                    value={playbackMode}
                    onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
                    className="px-2 py-1 font-mono text-xs border rounded bg-slate-950 text-slate-300 border-slate-800 focus:outline-none focus:border-white/50"
                  >
                    <option value="autoplay">Mode: Autoplay Next</option>
                    <option value="random">Mode: Random Play</option>
                    <option value="loop">Mode: Loop Track</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-xl font-bold text-white truncate">{activeTrack.title}</h3>
                <p className="text-xs truncate text-slate-400">{activeTrack.description}</p>
              </div>

              {!activeTrack.embedUrl && (
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-white bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-xs text-white/70">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevTrack}
                  className="px-4 py-3 font-mono text-xs font-bold transition rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  ◀◀
                </button>

                {activeTrack.embedUrl ? (
                  <div className="flex-1 py-3 text-sm font-bold tracking-wide text-center rounded-lg bg-slate-950 border border-neutral-700 text-white">
                    ▶ PLAYING IN BROADCAST MONITOR →
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1 py-3 text-sm font-bold tracking-wide transition rounded-lg bg-white hover:bg-neutral-200 text-slate-950"
                  >
                    {isPlaying ? 'PAUSE STREAM' : 'PLAY STREAM'}
                  </button>
                )}

                <button
                  onClick={handleNextTrack}
                  className="px-4 py-3 font-mono text-xs font-bold transition rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  ▶▶
                </button>
              </div>

              {showEq && (
                <div className="pt-3 space-y-3 transition-all border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-wider uppercase text-white">
                      Parametric Equalizer
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 text-[10px] font-mono">
                        <button onClick={() => applyPreset('flat')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">FLAT</button>
                        <button onClick={() => applyPreset('warm432')} className="px-1.5 py-0.5 bg-white/20 text-white rounded hover:bg-white/10">432Hz WARM</button>
                        <button onClick={() => applyPreset('vocal')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">VOCAL</button>
                        <button onClick={() => applyPreset('bass')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">BASS</button>
                      </div>
                      <div className="flex gap-1 pl-2 ml-1 text-[10px] font-mono border-l border-slate-800">
                        <button
                          onClick={() => setEqControlMode('sliders')}
                          className={`px-1.5 py-0.5 rounded ${eqControlMode === 'sliders' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          SLIDERS
                        </button>
                        <button
                          onClick={() => setEqControlMode('orb')}
                          className={`px-1.5 py-0.5 rounded ${eqControlMode === 'orb' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          ORB
                        </button>
                      </div>
                    </div>
                  </div>

                  {eqControlMode === 'orb' ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <EqOrb
                        onBassTrebleChange={handleOrbBassTreble}
                        onVolumeChange={setMasterVolumeValue}
                        onPanWidthChange={handleOrbPanWidth}
                      />
                      <div className="flex gap-4 font-mono text-[10px] text-slate-400">
                        <span>BASS {eqGains['60'] > 0 ? `+${eqGains['60']}` : eqGains['60']}dB</span>
                        <span>TREBLE {eqGains['12000'] > 0 ? `+${eqGains['12000']}` : eqGains['12000']}dB</span>
                        <span>VOL {masterVolume}%</span>
                        <span>PAN WIDTH {panWidthPct}%</span>
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-5 gap-1 pt-1 sm:gap-2">
                    {[
                      { freq: '60', label: '60Hz' },
                      { freq: '250', label: '250Hz' },
                      { freq: '1000', label: '1kHz' },
                      { freq: '4000', label: '4kHz' },
                      { freq: '12000', label: '12kHz' },
                    ].map((band) => (
                      <div key={band.freq} className="flex flex-col items-center space-y-1">
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={1}
                          value={eqGains[band.freq] || 0}
                          onChange={(e) => handleEqChange(band.freq, parseFloat(e.target.value))}
                          // Taller on mobile (h-24) for touch-drag precision on
                          // a vertical slider; reverts to the tighter h-16 once
                          // mouse precision is available at sm+.
                          className="w-full h-24 sm:h-16 accent-white bg-slate-950 rounded cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                        />
                        <span className="text-[10px] font-mono text-slate-400">{band.label}</span>
                        <span className="text-[9px] font-mono text-white">{eqGains[band.freq] > 0 ? `+${eqGains[band.freq]}` : eqGains[band.freq]}dB</span>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-2 text-center border bg-slate-900/60 border-neutral-700 rounded-xl">
              <span className="inline-block px-2 py-0.5 bg-white/10 text-white text-xs font-mono rounded">
                Video / Guide
              </span>
              <h3 className="text-xl font-bold text-white">Podcaster Studio Setup Guide</h3>
              <p className="text-xs text-slate-400">2-Min Overview</p>
              <p className="text-[11px] text-slate-600 max-w-xs mx-auto">
                Not recorded yet — paste a link or start Pod Cam on the right to begin broadcasting.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="px-1 font-mono text-xs tracking-wider uppercase text-slate-500">
              Tracks ({filteredTracks.length})
            </h4>
            <div className="pr-1 space-y-2 overflow-y-auto max-h-56">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => selectTrack(track)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                    activeTrack?.id === track.id
                      ? 'border-neutral-700 bg-white/10 text-white'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="mr-2 overflow-hidden">
                    <p className="text-xs font-semibold truncate text-slate-200">{track.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{track.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-white/70">{track.frequency}</span>
                    <button
                      onClick={(e) => deleteTrack(e, track.id)}
                      title="Delete Track"
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Camera & Reader */}
        <div className="flex flex-col space-y-4 lg:col-span-7">
          {(
            <div className="bg-[#12141a] border-t-2 border-l-2 border-t-white/90 border-l-white/90 border-b-2 border-r-2 border-b-black border-r-black rounded-xl shadow-[-3px_-3px_10px_rgba(255,255,255,0.3),8px_8px_20px_rgba(0,0,0,0.75),inset_1px_1px_2px_rgba(255,255,255,0.2)] p-5 relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-xs tracking-wider uppercase text-white">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Podcasts & Broadcast Monitor
                </span>
                <div className="flex items-center gap-2">
                  {isCameraActive && (
                    <span
                      title="PodCam Intent Controls: a big motion spike (wave / entering frame) skips to the next track"
                      className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition ${
                        motionFlash
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-500'
                      }`}
                    >
                      {motionFlash ? '● Motion → Next' : 'Intent Watch'}
                    </span>
                  )}
                  <button
                    onClick={toggleCamera}
                    className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition flex items-center gap-1.5 ${
                      isCameraActive
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-white text-black font-bold hover:bg-neutral-200'
                    }`}
                  >
                    {isCameraActive ? (
                      'Stop Broadcast'
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" /> Pod Cam
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Monitor layout toggle — 'full' is the original single-frame
                  behavior (default, unchanged), 'split' shows the real Pod
                  Cam feed next to whatever real media/embed is loaded,
                  'media' shows just the embed at full width. */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Layout</span>
                <div className="flex gap-1">
                  {([
                    ['full', 'Full Monitor'],
                    ['split', 'Split Screen'],
                    ['media', 'Media Only'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMonitorLayout(mode)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wide border transition ${
                        monitorLayout === mode
                          ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                          : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Mic Input — deliberately placed here (always visible,
                  independent of whether a music track is selected) rather
                  than inside the track-player's own EQ panel below, which
                  only renders once activeTrack is set. A host needs to be
                  able to talk over mic with no track playing at all, so
                  gating this behind track selection would have been a real
                  usability bug, not just a smaller scope decision. Mixes
                  into the exact same EQ/compressor/panner/VU-meter chain
                  the track audio runs through (see startMic: micGain
                  connects directly into filtersRef.current['60'], the same
                  first filter node the track's own source feeds into). */}
              <div className="p-2 space-y-2 border rounded-lg border-cyan-500/20 bg-cyan-950/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80">
                    Live Mic Input
                  </span>
                  <button
                    type="button"
                    onClick={refreshAudioInputDevices}
                    className="text-[10px] font-mono text-slate-500 hover:text-cyan-300 transition-colors"
                  >
                    Refresh Devices
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    onFocus={() => {
                      if (audioInputDevices.length === 0) refreshAudioInputDevices();
                    }}
                    className="flex-1 min-w-[160px] px-2 py-1.5 text-xs bg-[#0a0b0d] border border-slate-800 rounded font-mono text-slate-300 focus:outline-none focus:border-cyan-400/50"
                  >
                    <option value="">
                      {audioInputDevices.length === 0 ? 'Click to list input devices…' : 'Default microphone'}
                    </option>
                    {audioInputDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>

                  {micActive ? (
                    <button
                      type="button"
                      onClick={stopMic}
                      className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wide bg-red-950 text-red-300 border border-red-800 hover:bg-red-900 transition-colors"
                    >
                      Stop Mic
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startMic(selectedMicId)}
                      className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wide bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 transition-colors"
                    >
                      Enable Mic
                    </button>
                  )}
                </div>

                {micActive && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMicMuted((v) => !v)}
                      aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                      className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wide border transition ${
                        micMuted
                          ? 'bg-red-950 border-red-800 text-red-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {micMuted ? 'Muted' : 'Mute'}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={micGainPct}
                      onChange={(e) => setMicGainPct(Number(e.target.value))}
                      disabled={micMuted}
                      className="flex-1 accent-cyan-400 disabled:opacity-40"
                      aria-label="Microphone gain"
                    />
                    <span className="w-9 text-right text-[10px] font-mono text-slate-500">{micGainPct}%</span>
                  </div>
                )}

                {micError && <p className="text-[10px] font-mono text-red-400">{micError}</p>}
              </div>

              {/* Off-screen sampling canvas for PodCam motion detection —
                  never displayed, just read back into pixel data. */}
              <canvas ref={motionCanvasRef} className="hidden" />

              <input
                type="file"
                ref={mediaFileInputRef}
                onChange={handleLocalVideoSelect}
                accept="video/*"
                className="hidden"
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadMedia();
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Paste YouTube video/playlist URL or direct media link..."
                  className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-[#0a0b0d] border border-slate-800 rounded font-mono text-slate-300 focus:outline-none focus:border-white/50"
                />
                <button
                  type="button"
                  onClick={clearMedia}
                  disabled={!activeEmbedUrl && !localVideoUrl}
                  className="px-3 py-1.5 rounded text-xs font-mono transition bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  CLEAR
                </button>
              </form>

              {cameraError && (
                <div className="p-2 font-mono text-xs text-red-300 border border-red-800 rounded bg-red-950/60">
                  {cameraError}
                </div>
              )}

              {/* Master Studio Audio Rack VU meters flank the monitor
                  frame(s) — real per-channel peak levels (see VuMeter and
                  the ChannelSplitterNode wired in initAudioContext), not
                  decorative animation. */}
              <div className="flex items-stretch gap-2">
                <VuMeter analyserRef={leftAnalyserRef} label="L" />
                {(() => {
                  const cameraFeed = (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                      />
                      {!isCameraActive && (
                        // Plain black screen — no visualizer/particle
                        // graphics inside the monitor box, per explicit
                        // instruction. The dedicated full-screen Visualizer
                        // view (header button) is untouched; this only
                        // affects this inline fallback.
                        <div className="p-6 space-y-2 text-center">
                          <p className="font-mono text-xs text-slate-400">
                            {monitorLayout === 'split' ? 'HOST CAM STANDBY' : 'BROADCAST MONITOR STANDBY'}
                          </p>
                          <p className="text-slate-600 text-[11px] max-w-sm mx-auto">
                            Click &quot;Pod Cam&quot; above or paste a link to display video input.
                          </p>
                        </div>
                      )}
                    </>
                  );

                  const mediaFeed = localVideoUrl ? (
                    <video
                      ref={broadcastVideoRef}
                      src={localVideoUrl}
                      controls
                      className="w-full h-full object-cover"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                    />
                  ) : activeEmbedUrl ? (
                    activeEmbedUrl.endsWith('.mp4') || activeEmbedUrl.endsWith('.webm') ? (
                      <video
                        ref={broadcastVideoRef}
                        src={activeEmbedUrl}
                        controls
                        className="w-full h-full object-cover"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                      />
                    ) : activeEmbedUrl.includes('archive.org/embed/') ? (
                      // Internet Archive's own embed player — a real,
                      // cross-origin iframe with no postMessage control API,
                      // unlike the YouTube branch below. It plays back fine,
                      // it just can't feed currentTime into Pods Context
                      // Sync the way a bound YT.Player object can.
                      <iframe
                        key="archive-embed-player"
                        src={activeEmbedUrl}
                        className="w-full h-full border-0"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    ) : (
                      // React owns this wrapper but never renders anything
                      // inside it via JSX — the YouTube IFrame Player API
                      // gets an imperatively-created child div instead (see
                      // ytContainerRef's effect), so its DOM mutations
                      // never conflict with React's reconciliation of this
                      // subtree. A plain <iframe src=...> has no
                      // postMessage access to currentTime, which is what
                      // Pods Context Sync needs.
                      <div key="youtube-player-container" ref={ytContainerRef} className="w-full h-full" />
                    )
                  ) : (
                    <div className="p-6 space-y-2 text-center">
                      <p className="font-mono text-xs text-slate-400">NO MEDIA LOADED</p>
                      <p className="text-slate-600 text-[11px] max-w-sm mx-auto">
                        Paste a YouTube video/playlist URL or direct media link above.
                      </p>
                    </div>
                  );

                  if (monitorLayout === 'split') {
                    return (
                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="relative flex items-center justify-center overflow-hidden border rounded-lg aspect-video bg-[#0a0b0d] border-slate-800">
                          {cameraFeed}
                        </div>
                        <div className="relative flex items-center justify-center overflow-hidden border rounded-lg aspect-video bg-[#0a0b0d] border-slate-800">
                          {mediaFeed}
                        </div>
                      </div>
                    );
                  }

                  if (monitorLayout === 'media') {
                    return (
                      <div className="relative flex-1 flex items-center justify-center overflow-hidden border rounded-lg aspect-video bg-[#0a0b0d] border-slate-800">
                        {mediaFeed}
                      </div>
                    );
                  }

                  // 'full' — original single-frame priority (local video >
                  // embed > camera), byte-for-byte the same behavior this
                  // had before monitorLayout existed.
                  return (
                    <div className="relative flex-1 flex items-center justify-center overflow-hidden border rounded-lg aspect-video bg-[#0a0b0d] border-slate-800">
                      {localVideoUrl || activeEmbedUrl ? mediaFeed : cameraFeed}
                    </div>
                  );
                })()}
                <VuMeter analyserRef={rightAnalyserRef} label="R" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add YouTube Video/Playlist to Playlist */}
      {showAddPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleImportPlaylistUrl} className="w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl">
            <h3 className="text-lg font-bold text-white">Add Media / YouTube Playlist</h3>
            <p className="text-xs text-slate-400">Paste a YouTube video or playlist link to add it to your Playlist.</p>
            <input
              type="url"
              placeholder="Paste YouTube video or playlist URL..."
              value={addPlaylistUrl}
              onChange={(e) => setAddPlaylistUrl(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              autoFocus
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddPlaylistModal(false)}
                className="px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isImportingPlaylist}
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {isImportingPlaylist ? 'IMPORTING…' : 'IMPORT'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create Playlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreatePlaylist} className="w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl">
            <h3 className="text-lg font-bold text-white">Create New Playlist</h3>
            <p className="text-xs text-slate-400">Enter a title below to organize your audio tracks and podcasts.</p>
            <input
              type="text"
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200"
              >
                CREATE & OPEN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Files Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute text-slate-500 top-4 right-4 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>

            <h3 className="mb-1 text-lg font-bold text-white">Upload Files</h3>
            <p className="mb-6 text-xs text-slate-400">
              Select local audio files to add to <span className="font-semibold text-white">{activePlaylistObj?.name || 'this playlist'}</span>.
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full gap-2 p-8 mb-6 text-center transition border-2 border-dashed rounded-lg cursor-pointer border-neutral-700 bg-slate-950/50 hover:border-neutral-500 hover:bg-slate-950"
            >
              <span className="text-3xl text-slate-500">⇧</span>
              <span className="text-xs font-semibold text-slate-200">Click to browse local files</span>
              <span className="text-[10px] text-slate-500">Or drag audio files anywhere on this page</span>
            </button>

            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 font-mono text-xs uppercase text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 space-y-4 border bg-slate-900 border-slate-800 rounded-xl">
            <h3 className="pb-2 text-lg font-bold border-b text-white border-slate-800">
              Pods Hub & Audio Studio Instructions
            </h3>
            <div className="space-y-2 font-sans text-xs leading-relaxed text-slate-300">
              <p>• <strong>Creating Playlists:</strong> Click <code>+ NEW PLAYLIST</code> to open the creation dialog.</p>
              <p>• <strong>Parametric Equalizer:</strong> Toggle the <code>EQ</code> button next to the autoplay menu to adjust audio bands.</p>
              <p>• <strong>Downloading Sessions:</strong> Click the <strong>Download Arrow (↓)</strong> button to download free session files directly to your device.</p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
      </StudioOneConsole>
      )}
    </div>
  );
}