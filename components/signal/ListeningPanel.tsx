'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './signal.module.css';

type Phase = 'idle' | 'listening' | 'denied';

const MIC_ICON = (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" />
  </svg>
);

export default function ListeningPanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    levelRef.current = 0;
    setPhase('idle');
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      ctxRef.current = ctx;
      const buf = new Uint8Array(analyser.fftSize);
      const read = () => {
        if (!streamRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 5);
        requestAnimationFrame(read);
      };
      read();
      setPhase('listening');
    } catch {
      setPhase('denied');
    }
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let smooth = 0;
    const draw = (ms: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      smooth += (levelRef.current - smooth) * 0.15;
      const t = reduce ? 0 : ms / 1000;
      const mid = h / 2;
      const layers = [
        { c: 'rgba(63,208,201,0.55)', f: 1.0, s: 1.3, p: 0 },
        { c: 'rgba(110,140,255,0.5)', f: 1.4, s: 1.9, p: 1.7 },
        { c: 'rgba(190,120,255,0.4)', f: 0.8, s: 1.1, p: 3.1 },
      ];
      for (const L of layers) {
        g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w;
          const env = Math.sin(Math.PI * u) ** 2;
          const amp = (0.06 + smooth * 0.9) * h * 0.42 * env;
          const y = mid + Math.sin(u * 9 * L.f + t * L.s + L.p) * amp * (0.6 + 0.4 * Math.sin(u * 5 + t * 0.7));
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = L.c;
        g.lineWidth = 2;
        g.stroke();
      }
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, mid - 0.75, w, 1.5);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const on = phase === 'listening';
  return (
    <section className={styles.listenPanel} aria-label="Voice capture">
      <button
        type="button"
        className={`${styles.micBtn} ${on ? styles.micOn : ''}`}
        onClick={on ? stop : start}
        aria-pressed={on}
        aria-label={on ? 'Stop listening' : 'Start listening'}
      >
        {MIC_ICON}
      </button>
      <canvas ref={canvasRef} className={styles.wave} aria-hidden="true" />
      <p className={styles.listenLabel} role="status">
        {phase === 'listening' ? 'Listening…' : phase === 'denied' ? 'Microphone blocked' : 'Tap to listen'}
      </p>
    </section>
  );
}
