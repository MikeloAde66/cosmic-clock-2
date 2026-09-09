'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { RADIO_STATIONS, type RadioStation } from '@/lib/radioStations';

export interface QueueTrack {
  queueIndex: number;
  filename: string;
  fileUrl: string;
  durationSeconds?: number;
  weight: number;
  isAd?: boolean;
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'error';

interface RadioPlayerContextValue {
  station: RadioStation | null;
  queue: QueueTrack[];
  currentIndex: number;
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  volume: number;
  // Populated lazily on first playback (see ensureAnalyser below) — null
  // until then, and possibly still null after if Web Audio setup failed.
  analyserRef: React.RefObject<AnalyserNode | null>;
  // The actual <audio> element backing every station/queue-track play call
  // above. Exposed read-only for consumers that need to attach their own
  // renderer to the real element (e.g. Wavesurfer's MediaElement backend)
  // without duplicating a second parallel audio engine — callers should
  // still drive playback through togglePlayPause/seek/etc. above, not by
  // calling .play()/.pause() on this ref directly.
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playStation: (station: RadioStation) => Promise<void>;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  stop: () => void;
  // Pauses the radio without touching station/queue state — for external
  // media sources the global document-level listener below can't see
  // directly (cross-origin YouTube iframes), so they can still cede
  // priority to the radio the same way any native <video>/<audio> does.
  pauseForExternalMedia: () => void;
  // Program Manager — the toggle-gated 8-minute satellite rotation.
  // Off by default; activeProgramLabel names the current station or the
  // "Commercials & Ads Loop" break while enabled, null while off.
  programManagerEnabled: boolean;
  activeProgramLabel: string | null;
  toggleProgramManager: () => void;
  // Daily Queue — a fixed-order lineup (unlike Program Manager's shuffled
  // pool), for a specific curated sequence of stations to auto-advance
  // through cleanly. Each item advances either on a real 'ended' event
  // (finite files, e.g. a single archived episode — omit durationMs so it
  // plays to its actual end) or after durationMs (continuous streams,
  // which never fire 'ended'). Loops back to the first item once the last
  // one finishes/times out. The caller resolves the actual RadioStation
  // objects (including any dynamically-fetched ones) and passes them in —
  // this context has no knowledge of where stations come from beyond the
  // static RADIO_STATIONS list it already imports.
  dailyQueueEnabled: boolean;
  activeDailyQueueLabel: string | null;
  startDailyQueue: (items: DailyQueueItem[], options?: { autoplay?: boolean }) => void;
  stopDailyQueue: () => void;
  // Defaults to true (hidden) — the bar is scoped to Radio Central and
  // Media Flow specifically, not shown app-wide, so every other route/view
  // (Star Tracker PRO, Pods/Studio One, Kali, Products, etc.) just stays
  // hidden with no wiring needed. Radio Central (the standalone /radio
  // route) and Media Flow (its isLetsChatOpen overlay, or its "stack"
  // layout section while actually scrolled into view) are the only
  // callers that opt IN by setting this false while they're the active
  // view, and must restore it to true on unmount/close.
  playerBarHidden: boolean;
  setPlayerBarHidden: (hidden: boolean) => void;
}

export interface DailyQueueItem {
  station: RadioStation;
  // Omit for a finite file that should play to its real 'ended' event
  // (e.g. a single archived episode); set for a continuous stream, which
  // never fires 'ended' on its own.
  durationMs?: number;
}

const RadioPlayerContext = createContext<RadioPlayerContextValue | null>(null);

// Program Manager's core station pool and timing. 432Hz always leads off a
// fresh rotation (the "Default Start"); the other three are shuffled after
// it, and reshuffled again each time the pool wraps around.
const ROTATION_STATION_IDS = ['vault-432hz', 'rb-977-comedy', 'rb-977-smoothjazz', 'rb-historyradio'];
const ROTATION_AD_STATION_ID = 'vault-ads';
const ROTATION_BLOCK_MS = 8 * 60 * 1000;
const ROTATION_AD_MS = 60 * 1000;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRotationQueue(): string[] {
  const [first, ...rest] = ROTATION_STATION_IDS;
  return [first, ...shuffle(rest)];
}

// Mounted once at the app-shell level (outside the tab-switched content
// area) so the <audio> element — and playback — survives navigating between
// Home/Vault/Pods/Radio, instead of unmounting with the Radio tab the way
// everything except Pods currently does.
export function RadioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerBarHidden, setPlayerBarHidden] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const queueRef = useRef<QueueTrack[]>([]);
  const currentIndexRef = useRef(0);

  // Program Manager rotation bookkeeping.
  const rotationQueueRef = useRef<string[]>([]);
  const rotationIndexRef = useRef(0);
  const rotationPhaseRef = useRef<'station' | 'ad'>('station');
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Daily Queue bookkeeping — a fixed-order sibling to Program Manager's
  // shuffled rotation above. dailyQueueRef doubles as the "is it active"
  // signal (empty = off), the same convention queueRef already uses for
  // vault-track queues, rather than tracking a separate enabled ref.
  const dailyQueueRef = useRef<DailyQueueItem[]>([]);
  const dailyQueueIndexRef = useRef(0);
  const dailyQueueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once playback has started at least once this session (either via
  // Program Manager or a manual station pick) — gates whether the global
  // bar's Play button auto-enables Program Manager or just resumes.
  const hasEverPlayedRef = useRef(false);

  // No station in the static RADIO_STATIONS list is HLS today, but
  // dynamically-fetched directory results (Radio-Browser, a future
  // AzuraCast install) can be — this reuses the SAME <audio> element and
  // ref rather than standing up a second, parallel audio engine. Tears
  // down any previous hls.js instance first so switching from one HLS
  // stream to a plain one (or another HLS stream) doesn't leak instances.
  const setAudioSource = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (url.endsWith('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(audio);
      hlsRef.current = hls;
    } else {
      audio.src = url;
    }
  }, []);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Wires an AnalyserNode into the <audio> element's output graph for the
  // player-bar spectrum visualizer. Deliberately lazy — created on first
  // actual play() call (always a user gesture: a play button, a station
  // marker, etc.) rather than on mount. AudioContext starts 'suspended'
  // until resumed by a user gesture, and createMediaElementSource reroutes
  // the element's *entire* output through this graph — creating it eagerly
  // on mount, with nothing to resume it, would leave real playback silent.
  const ensureAnalyser = useCallback(() => {
    if (!audioRef.current) return;
    if (!audioCtxRef.current) {
      try {
        const AudioContextCtor =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextCtor();
        const source = audioCtx.createMediaElementSource(audioRef.current);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // 32 frequency bins — enough for a compact player-bar bar graph
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        audioCtxRef.current = audioCtx;
        mediaSourceRef.current = source;
        analyserRef.current = analyser;
      } catch (err) {
        // Most likely createMediaElementSource being called a second time on
        // the same element (e.g. React Strict Mode's dev-only double-invoke)
        // — it can only ever be bound once. Drop the visualizer rather than
        // let a Web Audio setup failure take playback down with it.
        console.error('Audio analyser setup failed (visualizer disabled, playback unaffected):', err);
      }
    }
    audioCtxRef.current?.resume().catch(() => {});
  }, []);

  const [station, setStation] = useState<RadioStation | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [programManagerEnabled, setProgramManagerEnabled] = useState(false);
  const [activeProgramLabel, setActiveProgramLabel] = useState<string | null>(null);
  const [dailyQueueEnabled, setDailyQueueEnabled] = useState(false);
  const [activeDailyQueueLabel, setActiveDailyQueueLabel] = useState<string | null>(null);

  // Primes the 432Hz Cosmic Instrumental Stream (vault-432hz) into the
  // persistent bottom bar on load, so it's the station shown/queued the
  // instant the app opens. This is a 'vault'-kind station, so priming it
  // (unlike a 'live' station's direct streamUrl) needs the same async
  // queue fetch playStation uses to get a real signed fileUrl for the
  // first track.
  // Deliberately does NOT call .play() here: real autoplay-with-sound
  // with no prior user gesture is blocked by every major browser, and
  // forcing it would either silently fail or surface as a false "error"
  // badge on a station that's actually fine — see ensureAnalyser's own
  // comment above for the same user-gesture constraint. A real Play
  // click (already wired in GlobalPlayerBar) starts it for real.
  useEffect(() => {
    const defaultStation = RADIO_STATIONS.find((s) => s.id === 'vault-432hz');
    if (!defaultStation) return;
    setStation(defaultStation);

    if (defaultStation.kind === 'live') {
      setAudioSource(defaultStation.streamUrl);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/radio/queue?station=${defaultStation.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const tracks: QueueTrack[] = data.tracks ?? [];
        if (tracks.length === 0) return;
        queueRef.current = tracks;
        setQueue(tracks);
        currentIndexRef.current = 0;
        setCurrentIndex(0);
        setAudioSource(tracks[0].fileUrl);
      } catch {
        // Priming failure is non-fatal — user can still manually select a station.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findStation = useCallback((id: string) => RADIO_STATIONS.find((s) => s.id === id) ?? null, []);

  const playIndex = useCallback((index: number) => {
    const track = queueRef.current[index];
    if (!track || !audioRef.current) return;
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setStatus('loading');
    ensureAnalyser();
    setAudioSource(track.fileUrl);
    audioRef.current.play().catch(() => setStatus('error'));
  }, [ensureAnalyser, setAudioSource]);

  // Core fetch-and-play logic, shared by manual station selection and the
  // Program Manager rotation below. Doesn't touch programManagerEnabled or
  // hasEverPlayedRef itself — callers decide what a station change means.
  // autoplay defaults to true (every existing caller is a real user
  // gesture or an already-playing session's own advance); pass false to
  // load/prime a station without attempting audio.play() — for callers
  // that aren't a user gesture, e.g. the Daily Queue's remote/schedule-
  // state activation, so it doesn't silently reject against browser
  // autoplay policy (or worse, actually play unannounced for a returning
  // visitor with high media-engagement history on this domain).
  const tuneStation = useCallback(async (nextStation: RadioStation, autoplay: boolean = true) => {
    setStatus('loading');
    setStation(nextStation);
    ensureAnalyser();

    try {
      // streamUrl/name are only ever used server-side as a fallback for
      // stations that aren't in the curated RADIO_STATIONS list (live
      // Radio-Browser search results — see RadioStreams.tsx) — harmless to
      // always include for curated stations too, since the server only
      // reaches for them after its own RADIO_STATIONS.find lookup fails.
      const params = new URLSearchParams({ station: nextStation.id });
      if (nextStation.kind === 'live') {
        params.set('streamUrl', nextStation.streamUrl);
        params.set('name', nextStation.name);
      }
      const res = await fetch(`/api/radio/queue?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data.kind === 'live') {
        queueRef.current = [];
        setQueue([]);
        setCurrentIndex(0);
        if (audioRef.current) {
          setAudioSource(data.streamUrl);
          if (autoplay) {
            await audioRef.current.play();
          } else {
            setStatus('idle');
          }
        }
        return;
      }

      const tracks: QueueTrack[] = data.tracks ?? [];
      queueRef.current = tracks;
      setQueue(tracks);
      if (tracks.length === 0) {
        setStatus('error');
        return;
      }
      playIndex(0);
    } catch (err) {
      console.error('Failed to play station:', err);
      setStatus('error');
    }
  }, [playIndex, ensureAnalyser, setAudioSource]);

  const clearRotationTimer = useCallback(() => {
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
  }, []);

  const clearDailyQueueTimer = useCallback(() => {
    if (dailyQueueTimerRef.current) {
      clearTimeout(dailyQueueTimerRef.current);
      dailyQueueTimerRef.current = null;
    }
  }, []);

  const stopDailyQueue = useCallback(() => {
    // Same "turning off just stops auto-switching" contract as
    // stopProgramManager — doesn't touch whatever's already playing.
    clearDailyQueueTimer();
    dailyQueueRef.current = [];
    setDailyQueueEnabled(false);
    setActiveDailyQueueLabel(null);
  }, [clearDailyQueueTimer]);

  // Alternates 8-minute station blocks with 1-minute ad breaks, looping
  // through the shuffled pool indefinitely (reshuffling — 432Hz-first stays
  // fixed only for the very first block of a fresh rotation) each time it
  // wraps around.
  const advanceRotation = useCallback(() => {
    if (rotationPhaseRef.current === 'station') {
      rotationPhaseRef.current = 'ad';
      const ad = findStation(ROTATION_AD_STATION_ID);
      if (ad) {
        tuneStation(ad);
        setActiveProgramLabel('Commercials & Ads Loop');
      }
      rotationTimerRef.current = setTimeout(() => advanceRotationRef.current(), ROTATION_AD_MS);
    } else {
      rotationIndexRef.current += 1;
      if (rotationIndexRef.current >= rotationQueueRef.current.length) {
        rotationIndexRef.current = 0;
        rotationQueueRef.current = buildRotationQueue();
      }
      rotationPhaseRef.current = 'station';
      const nextStation = findStation(rotationQueueRef.current[rotationIndexRef.current]);
      if (nextStation) {
        tuneStation(nextStation);
        setActiveProgramLabel(nextStation.name);
      }
      rotationTimerRef.current = setTimeout(() => advanceRotationRef.current(), ROTATION_BLOCK_MS);
    }
  }, [findStation, tuneStation]);

  // Ref mirror so the setTimeout chain above always calls the latest
  // advanceRotation (closing over current refs/state) without needing to
  // be recreated as its own setTimeout dependency.
  const advanceRotationRef = useRef(advanceRotation);
  useEffect(() => {
    advanceRotationRef.current = advanceRotation;
  }, [advanceRotation]);

  const startProgramManager = useCallback(() => {
    if (dailyQueueRef.current.length > 0) stopDailyQueue();
    rotationQueueRef.current = buildRotationQueue();
    rotationIndexRef.current = 0;
    rotationPhaseRef.current = 'station';
    setProgramManagerEnabled(true);
    const first = findStation(rotationQueueRef.current[0]); // vault-432hz — Default Start
    if (first) {
      tuneStation(first);
      setActiveProgramLabel(first.name);
    }
    clearRotationTimer();
    rotationTimerRef.current = setTimeout(() => advanceRotationRef.current(), ROTATION_BLOCK_MS);
  }, [findStation, tuneStation, clearRotationTimer, stopDailyQueue]);

  const stopProgramManager = useCallback(() => {
    // Turning off just stops auto-switching — it doesn't stop whatever's
    // already playing.
    clearRotationTimer();
    setProgramManagerEnabled(false);
    setActiveProgramLabel(null);
  }, [clearRotationTimer]);

  // Program Manager: a real, deliberate on/off toggle — this is the ONLY
  // way it can start. It was previously disabled because it used to
  // auto-enable itself the first time someone pressed the ordinary global
  // Play button (see togglePlayPause below), which "kept coming on"
  // unexpectedly with no separate opt-in. That auto-start path is gone for
  // good; togglePlayPause never touches Program Manager. This button is
  // the single, explicit control surface for it.
  const toggleProgramManager = useCallback(() => {
    if (programManagerEnabled) {
      stopProgramManager();
    } else {
      startProgramManager();
    }
  }, [programManagerEnabled, startProgramManager, stopProgramManager]);

  // Fixed-order advance: always moves to the next index (wrapping back to
  // 0 past the end, for continuous 24/7 broadcasting rather than stopping
  // after one pass), tunes it, and — only for a continuous-stream entry
  // (durationMs set) — schedules the next advance on a timer. A finite
  // entry (durationMs omitted) sets no timer at all; handleEnded below is
  // what advances it, once its real 'ended' event fires.
  const advanceDailyQueue = useCallback(() => {
    const queue = dailyQueueRef.current;
    if (queue.length === 0) return;
    dailyQueueIndexRef.current = (dailyQueueIndexRef.current + 1) % queue.length;
    const item = queue[dailyQueueIndexRef.current];
    tuneStation(item.station);
    setActiveDailyQueueLabel(item.station.name);
    clearDailyQueueTimer();
    if (item.durationMs) {
      dailyQueueTimerRef.current = setTimeout(() => advanceDailyQueueRef.current(), item.durationMs);
    }
  }, [tuneStation, clearDailyQueueTimer]);

  // Same ref-mirror trick advanceRotationRef uses, for the same reason:
  // the setTimeout chain and handleEnded both need to call the *latest*
  // advanceDailyQueue without becoming a dependency that recreates them.
  const advanceDailyQueueRef = useRef(advanceDailyQueue);
  useEffect(() => {
    advanceDailyQueueRef.current = advanceDailyQueue;
  }, [advanceDailyQueue]);

  const startDailyQueue = useCallback((items: DailyQueueItem[], options?: { autoplay?: boolean }) => {
    if (items.length === 0) return;
    if (programManagerEnabled) stopProgramManager();
    hasEverPlayedRef.current = true;
    dailyQueueRef.current = items;
    dailyQueueIndexRef.current = 0;
    setDailyQueueEnabled(true);
    const first = items[0];
    tuneStation(first.station, options?.autoplay ?? true);
    setActiveDailyQueueLabel(first.station.name);
    clearDailyQueueTimer();
    if (first.durationMs) {
      dailyQueueTimerRef.current = setTimeout(() => advanceDailyQueueRef.current(), first.durationMs);
    }
  }, [programManagerEnabled, stopProgramManager, tuneStation, clearDailyQueueTimer]);

  // Public station-selection API — a manual override. Explicitly picking a
  // channel (a station card, "Tune In") always wins: it cancels any running
  // rotation and tunes directly, without Program Manager clawing it back.
  const playStation = useCallback(async (nextStation: RadioStation) => {
    hasEverPlayedRef.current = true;
    if (programManagerEnabled) stopProgramManager();
    if (dailyQueueRef.current.length > 0) stopDailyQueue();
    await tuneStation(nextStation);
  }, [programManagerEnabled, stopProgramManager, stopDailyQueue, tuneStation]);

  const next = useCallback(() => {
    if (queueRef.current.length === 0) return;
    playIndex((currentIndexRef.current + 1) % queueRef.current.length);
  }, [playIndex]);

  const prev = useCallback(() => {
    if (queueRef.current.length === 0) return;
    playIndex((currentIndexRef.current - 1 + queueRef.current.length) % queueRef.current.length);
  }, [playIndex]);

  // The global bottom-bar Play/Pause button — strictly manual regardless of
  // Program Manager's on/off state: it just pauses/resumes whatever station
  // is currently tuned (the default-primed 432Hz stream on a fresh load, or
  // whatever the user last picked, including an active Program Manager
  // rotation). It never starts a rotation itself — only the dedicated
  // toggleProgramManager button above does that.
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === 'playing') {
      audio.pause();
      return;
    }
    hasEverPlayedRef.current = true;
    if (!audio.src) return;
    ensureAnalyser();
    audio.play().catch(() => setStatus('error'));
  }, [status, ensureAnalyser]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const stop = useCallback(() => {
    clearRotationTimer();
    setProgramManagerEnabled(false);
    setActiveProgramLabel(null);
    clearDailyQueueTimer();
    dailyQueueRef.current = [];
    setDailyQueueEnabled(false);
    setActiveDailyQueueLabel(null);
    audioRef.current?.pause();
    queueRef.current = [];
    currentIndexRef.current = 0;
    setStation(null);
    setQueue([]);
    setCurrentIndex(0);
    setStatus('idle');
  }, [clearRotationTimer, clearDailyQueueTimer]);

  const pauseForExternalMedia = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  // Global audio priority: any other <video>/<audio> element starting
  // playback anywhere in the app takes priority over the radio. The
  // 'play' event doesn't bubble, but a capture-phase listener on document
  // still sees it fire on any descendant — one listener here covers every
  // current and future native media element in the app without each of
  // them needing to know the radio exists. Cross-origin players (YouTube
  // iframes) don't fire DOM events the parent page can observe, so those
  // call pauseForExternalMedia() directly from their own state-change
  // handlers instead (see PodsModule's YT player).
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const target = e.target;
      if (target === audioRef.current) return;
      if (target instanceof HTMLMediaElement) {
        audioRef.current?.pause();
      }
    };
    document.addEventListener('play', handleGlobalPlay, true);
    return () => document.removeEventListener('play', handleGlobalPlay, true);
  }, []);

  // Auto-advance when a queued track finishes. Also drives the Daily
  // Queue's finite entries (durationMs omitted) — a continuous stream
  // entry never fires 'ended' on its own, so this is a no-op for those;
  // they're already advanced by advanceDailyQueue's own timer instead.
  const handleEnded = useCallback(() => {
    if (queueRef.current.length > 0) {
      next();
      return;
    }
    const dailyQueue = dailyQueueRef.current;
    const currentDailyItem = dailyQueue[dailyQueueIndexRef.current];
    if (dailyQueue.length > 0 && currentDailyItem && !currentDailyItem.durationMs) {
      advanceDailyQueueRef.current();
    }
  }, [next]);

  return (
    <RadioPlayerContext.Provider
      value={{
        station,
        queue,
        currentIndex,
        status,
        currentTime,
        duration,
        volume,
        analyserRef,
        audioRef,
        playStation,
        togglePlayPause,
        next,
        prev,
        seek,
        setVolume,
        stop,
        pauseForExternalMedia,
        programManagerEnabled,
        activeProgramLabel,
        toggleProgramManager,
        dailyQueueEnabled,
        activeDailyQueueLabel,
        startDailyQueue,
        stopDailyQueue,
        playerBarHidden,
        setPlayerBarHidden,
      }}
    >
      {/* crossOrigin lets createMediaElementSource read real frequency data
          for sources that send CORS headers (Vault tracks via Supabase
          Storage do). External live streams (BBC/NPR) generally don't, so
          the spectrum visualizer stays flat for those — playback itself is
          unaffected either way; crossOrigin only gates *analysis* access,
          not whether the element can play the source. */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onPlaying={() => setStatus('playing')}
        onWaiting={() => setStatus('loading')}
        onError={() => setStatus('error')}
        onPause={() => setStatus((s) => (s === 'error' ? s : 'idle'))}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
      />
      {children}
    </RadioPlayerContext.Provider>
  );
}

export function useRadioPlayer() {
  const ctx = useContext(RadioPlayerContext);
  if (!ctx) throw new Error('useRadioPlayer must be used within RadioPlayerProvider');
  return ctx;
}
