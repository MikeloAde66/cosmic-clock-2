'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Captions, Pause, Play, RotateCcw } from 'lucide-react';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';
import { captionTimeline, lineAt } from '@/lib/signal/captions';
import type { Dispatch } from '@/lib/signal/dispatches';
import { formatSeconds } from '@/lib/signal/speech';
import { CHARTS } from './ChartScenes';
import styles from './signal.module.css';
import { audioFor } from './audioManifest';

// A dispatch's illustrated scenes, one at a time, with the caption pinned in a
// band at the foot of the frame so it never covers the picture. The captions
// follow the recording; the scene changes where the narration moves on. The
// pictures are AI-generated illustrations and carry no text of their own.

export const MEDIA_EVENT = 'signal:media';

export default function VisualPlayer({ d }: { d: Dispatch }) {
  const scenes = d.visual?.scenes ?? [];
  const recording = audioFor(d.id);
  const lines = useMemo(() => captionTimeline(d), [d]);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [fraction, setFraction] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const radio = useRadioPlayer();
  const radioRef = useRef(radio);
  const resumeRadio = useRef(false);

  useEffect(() => {
    radioRef.current = radio;
  });

  const handBack = useCallback(() => {
    if (resumeRadio.current) {
      resumeRadio.current = false;
      radioRef.current.togglePlayPause();
    }
  }, []);

  // follow the recording while it plays
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const el = audio.current;
      if (el && el.duration) setFraction(Math.min(1, el.currentTime / el.duration));
    }, 100);
    return () => window.clearInterval(id);
  }, [playing]);

  const pause = useCallback(() => {
    audio.current?.pause();
    setPlaying(false);
    handBack();
  }, [handBack]);

  const play = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    window.dispatchEvent(new CustomEvent(MEDIA_EVENT, { detail: 'visual' }));
    if (radioRef.current.status === 'playing') {
      resumeRadio.current = true;
      radioRef.current.pauseForExternalMedia();
    }
    el.play().then(
      () => {
        setStarted(true);
        setPlaying(true);
      },
      () => {
        setFailed(true);
        handBack();
      },
    );
  }, [handBack]);

  const replay = useCallback(() => {
    const el = audio.current;
    if (el) el.currentTime = 0;
    setFraction(0);
    play();
  }, [play]);

  const seekToScene = useCallback(
    (scene: number) => {
      const el = audio.current;
      const first = lines.find((l) => l.scene === scene);
      if (!el || !first) return;
      const dur = el.duration || recording?.seconds || 0;
      el.currentTime = first.at * dur;
      setFraction(first.at);
      if (!playing) play();
    },
    [lines, playing, play, recording],
  );

  // Stop when something else on the page starts talking, and on the way out.
  useEffect(() => {
    const el = audio.current;
    const onMedia = (e: Event) => {
      if ((e as CustomEvent).detail !== 'visual') pause();
    };
    window.addEventListener(MEDIA_EVENT, onMedia);
    return () => {
      window.removeEventListener(MEDIA_EVENT, onMedia);
      el?.pause();
      handBack();
    };
  }, [pause, handBack]);

  if (!recording || scenes.length === 0) return null;

  const idx = lineAt(lines, fraction);
  const line = lines[idx];
  const ended = started && !playing && fraction >= 0.995;
  const shown = started ? line : lines[0];
  const elapsed = Math.round(fraction * recording.seconds);
  const sample = d.kind === 'sample';

  return (
    <figure className={styles.visual} aria-label={`Illustrated explainer: ${d.headline}`}>
      <div className={styles.visualStage}>
        {scenes.map((s, i) => {
          const on = i === shown.scene ? styles.visualImgOn : '';
          const Chart = s.chart ? CHARTS[s.chart] : undefined;
          return Chart ? (
            <div key={s.chart} role="img" aria-label={s.alt} className={`${styles.visualImg} ${on}`}>
              <Chart />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={s.src} src={s.src} alt={s.alt} className={`${styles.visualImg} ${on}`} />
          );
        })}
        {!playing && (
          <button type="button" className={styles.visualPlay} onClick={ended ? replay : play} aria-label={ended ? 'Replay the illustrated explainer' : started ? 'Resume' : 'Play the illustrated explainer'}>
            {ended ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
        )}
        <span className={styles.visualCount}>
          {shown.scene + 1} / {scenes.length}
        </span>
      </div>
      {captionsOn && (
        <figcaption className={styles.visualCaption} aria-live="off">
          <span key={idx} className={styles.visualCaptionText}>
            {started ? shown.text : 'Press play: the captions follow the voice.'}
          </span>
        </figcaption>
      )}
      <div className={styles.visualBar}>
        <button type="button" className={styles.listenBtn} onClick={playing ? pause : ended ? replay : play}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {playing ? 'PAUSE' : started && !ended ? 'RESUME' : ended ? 'REPLAY' : 'PLAY'}
        </button>
        <div className={styles.visualDots} role="group" aria-label="Scenes">
          {scenes.map((_, i) => (
            <button key={i} type="button" className={`${styles.visualDot} ${i === shown.scene ? styles.visualDotOn : ''}`} onClick={() => seekToScene(i)} aria-label={`Scene ${i + 1}`} aria-current={i === shown.scene} />
          ))}
        </div>
        <div className={styles.listenTrack} role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
          <div className={styles.listenFill} style={{ width: `${fraction * 100}%`, transition: 'none' }} />
        </div>
        <span className={styles.listenRate}>
          {formatSeconds(elapsed)} / {formatSeconds(recording.seconds)}
        </span>
        <button type="button" className={`${styles.listenRate} ${captionsOn ? styles.visualCcOn : ''}`} onClick={() => setCaptionsOn((c) => !c)} aria-pressed={captionsOn} aria-label="Captions">
          <Captions aria-hidden="true" />
        </button>
      </div>
      <p className={styles.visualNote}>{scenes.some((s) => s.chart) ? 'DIAGRAM · DRAWN IN CODE' : 'ILLUSTRATION · AI-GENERATED'} · {sample ? 'ILLUSTRATIVE FIGURES' : 'NO LIVE DATA'}{failed ? ' · AUDIO COULD NOT BE PLAYED' : ''}</p>
      <audio
        ref={audio}
        src={recording.src}
        preload="metadata"
        onEnded={() => {
          setFraction(1);
          setPlaying(false);
          handBack();
        }}
        onError={() => setFailed(true)}
      />
    </figure>
  );
}
