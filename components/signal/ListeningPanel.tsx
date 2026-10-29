'use client';

import { useEffect, useRef, useState } from 'react';
import { isPlaying, readLevel } from '@/lib/signal/level';
import styles from './signal.module.css';

const LAYERS = [
  { c: 'rgba(63,208,201,0.6)', f: 1.0, s: 1.3, p: 0 },
  { c: 'rgba(110,140,255,0.55)', f: 1.4, s: 1.9, p: 1.7 },
  { c: 'rgba(190,120,255,0.45)', f: 0.8, s: 1.1, p: 3.1 },
];

// A wave that moves with whatever Signal is playing, and rests as a thin line
// when nothing is.
export default function ListeningPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let smooth = 0;
    let was = false;
    const draw = (ms: number) => {
      const on = isPlaying();
      if (on !== was) {
        was = on;
        setPlaying(on);
      }
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      smooth += ((on ? readLevel() : 0) - smooth) * 0.18;
      const t = reduce ? 0 : ms / 1000;
      const mid = h / 2;
      for (const L of LAYERS) {
        g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w;
          const env = Math.sin(Math.PI * u) ** 2;
          const amp = smooth * h * 0.5 * env;
          const y = mid + Math.sin(u * 9 * L.f + t * L.s + L.p) * amp * (0.6 + 0.4 * Math.sin(u * 5 + t * 0.7));
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
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

  return (
    <section className={styles.listenPanel} aria-label="Signal wave">
      <canvas ref={canvasRef} className={styles.wave} aria-hidden="true" />
      <p className={styles.listenLabel} role="status" style={{ opacity: playing ? 1 : 0 }}>
        {playing ? 'Listening…' : ' '}
      </p>
    </section>
  );
}
