'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface CosmicVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  trackTitle?: string;
  // Omit when embedding inline (e.g. inside the Broadcast Monitor frame) —
  // there's nothing to navigate "back" from in that context.
  onBack?: () => void;
}

// Deterministic PRNG (mulberry32) — same approach as Starfield.tsx, so star
// positions are stable across renders instead of jumping every re-mount.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 48;
const rand = mulberry32(432);
// Each star is tied to one real frequency bin of the current track's own
// analyser data — there's no multi-user "presence" system in this app, so
// this deliberately is NOT a stand-in for other connected people. It's a
// single-source audio-reactive field, same underlying data as the ring
// visualizer, just rendered as a starfield instead of bars.
const STARS = Array.from({ length: STAR_COUNT }, () => ({
  xPct: rand() * 100,
  yPct: rand() * 100,
  baseRadius: 1 + rand() * 1.8,
  binFraction: rand(), // 0..1, resolved against the real bin count at render time
}));

export default function CosmicVisualizer({ analyser, isPlaying, trackTitle, onBack }: CosmicVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>(0);
  const [mode, setMode] = useState<'rings' | 'celestial'>('celestial');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const renderRings = (width: number, height: number, bins: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      if (!dataArray) return;

      const bassBins = Math.max(4, Math.floor(bins * 0.15));
      const bassAvg = dataArray.slice(0, bassBins).reduce((a, b) => a + b, 0) / bassBins;

      const coreRadius = Math.min(width, height) * 0.08 + bassAvg * 0.35;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.4, 'rgba(147, 197, 253, 0.55)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      const ringRadius = Math.min(width, height) * 0.32;
      for (let i = 0; i < bins; i++) {
        const value = dataArray[i] / 255;
        const angle = (i / bins) * Math.PI * 2;
        const barLength = value * ringRadius * 0.9;
        const innerX = centerX + Math.cos(angle) * ringRadius;
        const innerY = centerY + Math.sin(angle) * ringRadius;
        const outerX = centerX + Math.cos(angle) * (ringRadius + barLength);
        const outerY = centerY + Math.sin(angle) * (ringRadius + barLength);

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + value * 0.6})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const renderCelestial = (width: number, height: number, bins: number) => {
      for (const star of STARS) {
        const x = (star.xPct / 100) * width;
        const y = (star.yPct / 100) * height;
        const binIndex = Math.min(bins - 1, Math.floor(star.binFraction * bins));
        const value = dataArray && isPlaying ? dataArray[binIndex] / 255 : 0;
        const radius = star.baseRadius + value * 6;
        const glow = 0.25 + value * 0.75;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
        gradient.addColorStop(0, `rgba(216, 180, 254, ${glow})`);
        gradient.addColorStop(1, 'rgba(216, 180, 254, 0)');
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, glow + 0.2)})`;
        ctx.fill();
      }
    };

    const render = () => {
      frameRef.current = requestAnimationFrame(render);
      const { width, height } = canvas;

      // Fading trail rather than a hard clear, so motion reads as continuous
      ctx.fillStyle = 'rgba(7, 11, 20, 0.25)';
      ctx.fillRect(0, 0, width, height);

      if (analyser && dataArray) analyser.getByteFrequencyData(dataArray);
      const bins = dataArray?.length ?? 0;

      if (mode === 'celestial') {
        renderCelestial(width, height, Math.max(1, bins));
      } else if (analyser && dataArray && isPlaying) {
        renderRings(width, height, bins);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [analyser, isPlaying, mode]);

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden bg-[#070b14]">
      {onBack && (
        <div className="absolute z-10 top-4 left-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      )}

      <div className="absolute z-10 flex gap-1 top-4 left-1/2 -translate-x-1/2">
        <button
          onClick={() => setMode('celestial')}
          className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wide border transition ${
            mode === 'celestial'
              ? 'bg-white/20 border-neutral-600 text-white'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Celestial
        </button>
        <button
          onClick={() => setMode('rings')}
          className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wide border transition ${
            mode === 'rings'
              ? 'bg-white/20 border-neutral-600 text-white'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Rings
        </button>
      </div>

      {trackTitle && (
        <div className="absolute z-10 text-right top-4 right-4">
          <span className="block text-[10px] font-mono tracking-widest uppercase text-white/50">Now Playing</span>
          <span className="font-mono text-xs text-white/80">{trackTitle}</span>
        </div>
      )}

      <canvas ref={canvasRef} className="w-full h-full" />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="font-mono text-xs tracking-widest uppercase text-white/40">Press play to activate visuals</p>
        </div>
      )}
    </div>
  );
}
