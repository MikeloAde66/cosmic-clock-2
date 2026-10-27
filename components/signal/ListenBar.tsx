'use client';

import { Pause, Play, Square } from 'lucide-react';
import { formatSeconds, listenMinutes } from '@/lib/signal/speech';
import styles from './signal.module.css';
import { audioFor } from './audioManifest';
import { useReadAloud } from './useReadAloud';

// The Listen control: play a short read of a dispatch (or of the whole issue)
// aloud, with pause, stop and a speed toggle. It plays a recording in an
// AI-generated voice when one exists, and the browser's own voice otherwise.
export default function ListenBar({ id, chunks, label }: { id: string; chunks: string[]; label: string }) {
  const { speechSupport, state, rate, usingRecording, start, pause, resume, stop, cycleRate } = useReadAloud();
  const recording = audioFor(id);

  if (!recording) {
    if (speechSupport === 'unknown') return null;
    if (speechSupport === 'no') return <p className={styles.listenNote}>Read-aloud is not available in this browser.</p>;
  }

  const active = state.status !== 'idle';
  const pct = state.total ? Math.round((state.index / state.total) * 100) : 0;
  const length = recording ? formatSeconds(recording.seconds) : `${listenMinutes(chunks)} MIN`;

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
        <button type="button" className={styles.listenBtn} onClick={() => start(chunks, recording?.src)}>
          <Play aria-hidden="true" /> {label} · {length}
        </button>
      )}
      {recording && usingRecording && active && <span className={styles.listenNote}>AI-generated voice</span>}
      {recording && !active && <span className={styles.listenNote}>AI voice</span>}
      <span className={styles.srOnly} aria-live="polite">
        {state.status === 'speaking' ? 'Reading aloud' : state.status === 'paused' ? 'Paused' : ''}
      </span>
    </div>
  );
}
