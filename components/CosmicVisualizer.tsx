'use client';

import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

interface CosmicVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  trackTitle?: string;
  // Omit when embedding inline (e.g. inside the Broadcast Monitor frame) —
  // there's nothing to navigate "back" from in that context.
  onBack?: () => void;
}

export default function CosmicVisualizer({ analyser, isPlaying, trackTitle, onBack }: CosmicVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>(0);

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

    const render = () => {
      frameRef.current = requestAnimationFrame(render);
      const { width, height } = canvas;
      const centerX = width / 2;
      const centerY = height / 2;

      // Fading trail rather than a hard clear, so motion reads as continuous
      ctx.fillStyle = 'rgba(7, 11, 20, 0.25)';
      ctx.fillRect(0, 0, width, height);

      if (!analyser || !dataArray || !isPlaying) return;

      analyser.getByteFrequencyData(dataArray);
      const bins = dataArray.length;
      const bassBins = Math.max(4, Math.floor(bins * 0.15));
      const bassAvg = dataArray.slice(0, bassBins).reduce((a, b) => a + b, 0) / bassBins;

      // Pulsing core, driven by bass energy
      const coreRadius = Math.min(width, height) * 0.08 + bassAvg * 0.35;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.4, 'rgba(147, 197, 253, 0.55)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Ring of bars circling the core, one per frequency bin
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

    render();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [analyser, isPlaying]);

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
