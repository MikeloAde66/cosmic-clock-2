'use client';

import { Pause, Play, Square } from 'lucide-react';
import { listenMinutes } from '@/lib/signal/speech';
import styles from './signal.module.css';
import { useReadAloud } from './useReadAloud';

// The Listen control: play a short read of a dispatch (or of the whole issue)
// aloud, with pause, stop and a speed toggle.
export default function ListenBar({ chunks, label }: { chunks: string[]; label: string }) {
  const { support, state, rate, start, pause, resume, stop, cycleRate } = useReadAloud();
  if (support === 'unknown') return null;
  if (support === 'no') return <p className={styles.listenNote}>Read-aloud is not available in this browser.</p>;

  const active = state.status !== 'idle';
  const pct = state.total ? Math.round((state.index / state.total) * 100) : 0;

  return (
    <div className={styles.listen} role="group" aria-label={label}>
      {active ? (
        <>
          {state.status === 'paused' ? (
            <button type="button" className={styles.listenBtn} onClick={resume}>
              <Play aria-hidden="true" /> RESUME
            </button>
          ) : (
            <button type="button" className={styles.listenBtn} onClick={pause}>
              <Pause aria-hidden="true" /> PAUSE
            </button>
          )}
          <button type="button" className={styles.listenBtn} onClick={stop} aria-label="Stop reading">
            <Square aria-hidden="true" /> STOP
          </button>
          <button type="button" className={styles.listenRate} onClick={cycleRate} aria-label={`Speed ${rate} times, tap to change`}>
            {rate}×
          </button>
          <div className={styles.listenTrack} role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className={styles.listenFill} style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <button type="button" className={styles.listenBtn} onClick={() => start(chunks)}>
          <Play aria-hidden="true" /> {label} · {listenMinutes(chunks)} MIN
        </button>
      )}
      <span className={styles.srOnly} aria-live="polite">
        {state.status === 'speaking' ? 'Reading aloud' : state.status === 'paused' ? 'Paused' : ''}
      </span>
    </div>
  );
}
