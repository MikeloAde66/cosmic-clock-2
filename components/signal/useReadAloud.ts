'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';
import { createAudioReader, createReader, speechSupported } from '@/lib/signal/reader';
import type { ReaderState } from '@/lib/signal/reader';
import { MEDIA_EVENT } from './VisualPlayer';

const RATES = [1, 1.25, 1.5];
const IDLE: ReaderState = { status: 'idle', index: 0, total: 0 };
const noopSubscribe = () => () => undefined;
const clientSupport = () => (speechSupported() ? 'yes' : 'no');
const serverSupport = () => 'unknown';

type Controls = { start?: () => void; pause: () => void; resume: () => void; stop: () => void; setRate: (r: number) => void; destroy: () => void };

/**
 * Listening for Signal. It plays a pre-recorded mp3 when there is one and falls
 * back to the browser's own speech if the file cannot be played. If the radio
 * is playing it is paused meanwhile and handed back afterwards, since the
 * radio's player bar is not shown on this page.
 */
export function useReadAloud() {
  const speechSupport = useSyncExternalStore(noopSubscribe, clientSupport, serverSupport);
  const [state, setState] = useState<ReaderState>(IDLE);
  const [rate, setRate] = useState(RATES[0]);
  const [usingRecording, setUsingRecording] = useState(false);
  const radio = useRadioPlayer();
  const radioRef = useRef(radio);
  const resumeRadio = useRef(false);
  const speech = useRef<ReturnType<typeof createReader> | null>(null);
  const recording = useRef<Controls | null>(null);
  const rateRef = useRef(RATES[0]);

  useEffect(() => {
    radioRef.current = radio;
  });

  const handBack = useCallback(() => {
    if (resumeRadio.current) {
      resumeRadio.current = false;
      radioRef.current.togglePlayPause();
    }
  }, []);

  useEffect(() => {
    if (speechSupported()) speech.current = createReader(setState, handBack);
    return () => {
      speech.current?.destroy();
      speech.current = null;
      recording.current?.destroy();
      recording.current = null;
      handBack();
    };
  }, [handBack]);

  const start = useCallback(
    (chunks: string[], audioSrc?: string) => {
      speech.current?.stop();
      recording.current?.destroy();
      recording.current = null;
      window.dispatchEvent(new CustomEvent(MEDIA_EVENT, { detail: 'listen' }));
      const now = radioRef.current;
      if (now.status === 'playing') {
        resumeRadio.current = true;
        now.pauseForExternalMedia();
      }
      const speak = () => {
        setUsingRecording(false);
        const r = speech.current;
        if (!r) {
          handBack();
          return;
        }
        r.setRate(rateRef.current);
        r.start(chunks);
      };
      if (audioSrc) {
        setUsingRecording(true);
        const rec = createAudioReader(audioSrc, setState, handBack, speak);
        recording.current = rec;
        rec.setRate(rateRef.current);
        rec.start();
      } else {
        speak();
      }
    },
    [handBack],
  );

  // the illustrated player starting means this reader should step aside
  useEffect(() => {
    const onMedia = (e: Event) => {
      if ((e as CustomEvent).detail === 'visual') {
        speech.current?.stop();
        recording.current?.stop();
      }
    };
    window.addEventListener(MEDIA_EVENT, onMedia);
    return () => window.removeEventListener(MEDIA_EVENT, onMedia);
  }, []);

  const active = () => (recording.current ?? speech.current) as Controls | null;
  const pause = useCallback(() => active()?.pause(), []);
  const resume = useCallback(() => active()?.resume(), []);
  const stop = useCallback(() => active()?.stop(), []);
  const cycleRate = useCallback(() => {
    setRate((cur) => {
      const next = RATES[(RATES.indexOf(cur) + 1) % RATES.length];
      rateRef.current = next;
      recording.current?.setRate(next);
      speech.current?.setRate(next);
      return next;
    });
  }, []);

  return { speechSupport, state, rate, usingRecording, start, pause, resume, stop, cycleRate };
}
