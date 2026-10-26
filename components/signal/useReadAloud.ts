'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';
import { createReader, speechSupported } from '@/lib/signal/reader';
import type { ReaderState } from '@/lib/signal/reader';

const RATES = [1, 1.25, 1.5];
const IDLE: ReaderState = { status: 'idle', index: 0, total: 0 };
const noopSubscribe = () => () => undefined;
const clientSupport = () => (speechSupported() ? 'yes' : 'no');
const serverSupport = () => 'unknown';

/**
 * Read-aloud for Signal using the browser's own speech. If the radio is playing
 * it is paused while reading and handed back afterwards, since the radio's
 * player bar is not shown on this page.
 */
export function useReadAloud() {
  const support = useSyncExternalStore(noopSubscribe, clientSupport, serverSupport);
  const [state, setState] = useState<ReaderState>(IDLE);
  const [rate, setRate] = useState(RATES[0]);
  const radio = useRadioPlayer();
  const radioRef = useRef(radio);
  const resumeRadio = useRef(false);
  const reader = useRef<ReturnType<typeof createReader> | null>(null);

  useEffect(() => {
    radioRef.current = radio;
  });

  useEffect(() => {
    if (!speechSupported()) return;
    const handBack = () => {
      if (resumeRadio.current) {
        resumeRadio.current = false;
        radioRef.current.togglePlayPause();
      }
    };
    const r = createReader(setState, handBack);
    reader.current = r;
    return () => {
      r.destroy();
      reader.current = null;
      handBack();
    };
  }, []);

  const start = useCallback((chunks: string[]) => {
    const r = reader.current;
    if (!r) return;
    const now = radioRef.current;
    if (now.status === 'playing') {
      resumeRadio.current = true;
      now.pauseForExternalMedia();
    }
    r.start(chunks);
  }, []);
  const pause = useCallback(() => reader.current?.pause(), []);
  const resume = useCallback(() => reader.current?.resume(), []);
  const stop = useCallback(() => reader.current?.stop(), []);
  const cycleRate = useCallback(() => {
    setRate((cur) => {
      const next = RATES[(RATES.indexOf(cur) + 1) % RATES.length];
      reader.current?.setRate(next);
      return next;
    });
  }, []);

  return { support, state, rate, start, pause, resume, stop, cycleRate };
}
