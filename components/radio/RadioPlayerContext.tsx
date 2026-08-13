'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { RadioStation } from '@/lib/radioStations';

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
}

const RadioPlayerContext = createContext<RadioPlayerContextValue | null>(null);

// Mounted once at the app-shell level (outside the tab-switched content
// area) so the <audio> element — and playback — survives navigating between
// Home/Vault/Pods/Radio, instead of unmounting with the Radio tab the way
// everything except Pods currently does.
export function RadioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<QueueTrack[]>([]);
  const currentIndexRef = useRef(0);

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

  const playIndex = useCallback((index: number) => {
    const track = queueRef.current[index];
    if (!track || !audioRef.current) return;
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setStatus('loading');
    ensureAnalyser();
    audioRef.current.src = track.fileUrl;
    audioRef.current.play().catch(() => setStatus('error'));
  }, [ensureAnalyser]);

  const playStation = useCallback(async (nextStation: RadioStation) => {
    setStatus('loading');
    setStation(nextStation);
    ensureAnalyser();

    try {
      const res = await fetch(`/api/radio/queue?station=${encodeURIComponent(nextStation.id)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data.kind === 'live') {
        queueRef.current = [];
        setQueue([]);
        setCurrentIndex(0);
        if (audioRef.current) {
          audioRef.current.src = data.streamUrl;
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
  }, [playIndex, ensureAnalyser]);

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
