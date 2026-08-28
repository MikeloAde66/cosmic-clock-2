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
  // Program Manager — the toggle-gated 24-hour automated broadcast clock.
  // Off by default; activeProgramLabel names the current block/override
  // (e.g. "Ai OneKast", "BBC World Service") while enabled, null while off.
  programManagerEnabled: boolean;
  activeProgramLabel: string | null;
  toggleProgramManager: () => void;
  // Set by the home page (the only route with a Pods/Studio One tab) to
  // hide GlobalPlayerBar while that video-only workspace is active — now
  // that the bar itself is mounted globally in app/layout.tsx rather than
  // locally on the home page, this is the only way a specific route/tab
  // can still opt out of showing it. Defaults to false (visible) so every
  // other route just shows the bar with no wiring needed.
  playerBarHidden: boolean;
  setPlayerBarHidden: (hidden: boolean) => void;
}

const RadioPlayerContext = createContext<RadioPlayerContextValue | null>(null);

// Mounted once at the app-shell level (outside the tab-switched content
// area) so the <audio> element — and playback — survives navigating between
// Home/Vault/Pods/Radio, instead of unmounting with the Radio tab the way
// everything except Pods currently does.
export function RadioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerBarHidden, setPlayerBarHidden] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const queueRef = useRef<QueueTrack[]>([]);
  const currentIndexRef = useRef(0);

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

  // Primes .977 Comedy (rb-977-comedy) into the persistent bottom bar on
  // load, so its name and preloaded audio src are ready the instant the
  // app opens — a real 'live' station with a static streamUrl (StreamThe
  // World CDN, verified working via an actual browser canplay event, not
  // just an HTTP check), so this is the simple direct-src priming path,
  // not the async vault-queue fetch a 'vault'-kind default would need.
  // Deliberately does NOT call .play() here: real autoplay-with-sound
  // with no prior user gesture is blocked by every major browser, and
  // forcing it would either silently fail or surface as a false "error"
  // badge on a station that's actually fine — see ensureAnalyser's own
  // comment above for the same user-gesture constraint. A real Play
  // click (already wired in GlobalPlayerBar) starts it for real.
  useEffect(() => {
    const defaultStation = RADIO_STATIONS.find((s) => s.id === 'rb-977-comedy');
    if (defaultStation?.kind === 'live') {
      setStation(defaultStation);
      setAudioSource(defaultStation.streamUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const playStation = useCallback(async (nextStation: RadioStation) => {
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
          await audioRef.current.play();
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

  const next = useCallback(() => {
    if (queueRef.current.length === 0) return;
    playIndex((currentIndexRef.current + 1) % queueRef.current.length);
  }, [playIndex]);

  const prev = useCallback(() => {
    if (queueRef.current.length === 0) return;
    playIndex((currentIndexRef.current - 1 + queueRef.current.length) % queueRef.current.length);
  }, [playIndex]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (status === 'playing') {
      audio.pause();
    } else {
      ensureAnalyser();
      audio.play().catch(() => setStatus('error'));
    }
  }, [status, ensureAnalyser]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    queueRef.current = [];
    currentIndexRef.current = 0;
    setStation(null);
    setQueue([]);
    setCurrentIndex(0);
    setStatus('idle');
  }, []);

  const pauseForExternalMedia = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  // Program Manager — a toggle-gated 24-hour automated broadcast clock,
  // built entirely from real stations already in RADIO_STATIONS (curated
  // live streams + the real Vault-backed 432Hz music station, branded here
  // as "Ai OneKast"). OFF by default; toggling it ON is itself the
  // explicit user gesture that authorizes it to immediately tune to
  // whatever block covers the current time — the same as turning on a
  // real radio and getting whatever's currently airing, not unsolicited
  // autoplay. Toggling it OFF just stops auto-switching; it doesn't stop
  // whatever's currently playing.
  //
  // Two disclosed simplifications, since the literal spec isn't fully
  // buildable: the 2:39-4pm "Comedy & Weather" block runs Comedy only —
  // there's no text-to-speech or audio weather content anywhere in this
  // app, only the visual NOAA widget. And 11pm/1am aren't real replays of
  // the 4pm/7pm segments (that would require actually recording those
  // live streams, which doesn't exist) — they're just BBC/NPR live again.
  const PROGRAM_BLOCKS: { startMinutes: number; endMinutes: number; label: string; stationId: string }[] = [
    { startMinutes: 2 * 60, endMinutes: 4 * 60, label: 'History Channel', stationId: 'rb-historyradio' },
    { startMinutes: 5 * 60, endMinutes: 8 * 60, label: 'Comedy Skits Block', stationId: 'rb-977-comedy' },
    { startMinutes: 8 * 60 + 5, endMinutes: 10 * 60 + 35, label: '.977 Jazz Stream', stationId: 'rb-977-smoothjazz' },
    { startMinutes: 10 * 60 + 36, endMinutes: 12 * 60 + 36, label: 'Ai OneKast', stationId: 'vault-432hz' },
    { startMinutes: 12 * 60 + 37, endMinutes: 14 * 60 + 37, label: 'BBC News & World Culture', stationId: 'bbc-world' },
    { startMinutes: 14 * 60 + 39, endMinutes: 16 * 60, label: 'Comedy Block', stationId: 'rb-977-comedy' },
  ];
  // Gaps between the blocks above (and overnight, 4-5am/1:15-2am) default
  // to Ai OneKast — a reasonable fallback rotation, not something the
  // schedule itself specified.
  const DEFAULT_BLOCK_STATION_ID = 'vault-432hz';

  const NEWS_OVERRIDES: { startMinutes: number; stationId: 'bbc-world' | 'npr-news' }[] = [
    { startMinutes: 16 * 60, stationId: 'bbc-world' }, // 4:00pm
    { startMinutes: 19 * 60, stationId: 'npr-news' }, // 7:00pm
    { startMinutes: 23 * 60, stationId: 'bbc-world' }, // 11:00pm
    { startMinutes: 25 * 60, stationId: 'npr-news' }, // 1:00am (next day)
  ];
  const NEWS_OVERRIDE_MINUTES = 15;

  const [programManagerEnabled, setProgramManagerEnabled] = useState(false);
  const [activeProgramLabel, setActiveProgramLabel] = useState<string | null>(null);
  const lastTriggeredOverrideRef = useRef<string | null>(null);
  // Non-null while a news override's 15-minute window is running — this is
  // the single source of truth for "are we mid-override", checked first on
  // every tick so the base block schedule can never interrupt a news
  // broadcast partway through (a real bug in an earlier draft: matching
  // only the exact starting minute meant the very next 30s tick fell
  // through to block-matching and instantly cut the news off).
  const overrideReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedBlockStationIdRef = useRef<string | null>(null);

  const findStation = useCallback(
    (id: string) => RADIO_STATIONS.find((s) => s.id === id) ?? null,
    []
  );

  const evaluateProgramManager = useCallback(() => {
    if (overrideReturnTimerRef.current) return; // mid-override — wait for its own return timer

    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    // Also matches the +24h form so "1am" (minutesNow=60) matches the
    // 25*60 slot the same way "11pm today" does, without needing a
    // separate wraparound-day branch.
    const overrideSlot = NEWS_OVERRIDES.find(
      (o) => o.startMinutes === minutesNow || o.startMinutes === minutesNow + 24 * 60
    );

    if (overrideSlot) {
      const overrideKey = `${now.toDateString()} ${overrideSlot.startMinutes}`;
      if (lastTriggeredOverrideRef.current === overrideKey) return; // already ran this exact slot
      lastTriggeredOverrideRef.current = overrideKey;

      const newsStation = findStation(overrideSlot.stationId);
      if (newsStation) {
        playStation(newsStation);
        setActiveProgramLabel(newsStation.name);
      }
      overrideReturnTimerRef.current = setTimeout(() => {
        overrideReturnTimerRef.current = null;
        evaluateProgramManagerRef.current?.(); // re-evaluate fresh — the base block may have changed in the meantime
      }, NEWS_OVERRIDE_MINUTES * 60 * 1000);
      return;
    }

    const block = PROGRAM_BLOCKS.find((b) => minutesNow >= b.startMinutes && minutesNow < b.endMinutes);
    const targetStationId = block?.stationId ?? DEFAULT_BLOCK_STATION_ID;
    const targetLabel = block?.label ?? 'Ai OneKast';

    if (lastAppliedBlockStationIdRef.current !== targetStationId) {
      lastAppliedBlockStationIdRef.current = targetStationId;
      const targetStation = findStation(targetStationId);
      if (targetStation) {
        playStation(targetStation);
        setActiveProgramLabel(targetLabel);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findStation, playStation]);

  // A ref mirror so the override-return setTimeout above always calls the
  // latest evaluateProgramManager (which closes over current refs/state)
  // without needing to be a dependency of its own setTimeout closure.
  const evaluateProgramManagerRef = useRef(evaluateProgramManager);
  useEffect(() => {
    evaluateProgramManagerRef.current = evaluateProgramManager;
  }, [evaluateProgramManager]);

  const toggleProgramManager = useCallback(() => {
    setProgramManagerEnabled((prev) => {
      const next = !prev;
      if (!next) {
        // Turning off: stop auto-switching, but don't touch what's
        // already playing.
        if (overrideReturnTimerRef.current) clearTimeout(overrideReturnTimerRef.current);
        overrideReturnTimerRef.current = null;
        setActiveProgramLabel(null);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!programManagerEnabled) return;
    lastAppliedBlockStationIdRef.current = null; // force an immediate re-evaluation on enable
    evaluateProgramManagerRef.current();
    const interval = setInterval(() => evaluateProgramManagerRef.current(), 30 * 1000);
    return () => clearInterval(interval);
  }, [programManagerEnabled]);

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

  // Auto-advance when a queued track finishes — a no-op for live streams,
  // which have no queue to advance through.
  const handleEnded = useCallback(() => {
    if (queueRef.current.length > 0) next();
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
