'use client';

import React, { useEffect, useRef } from 'react';
import NoaaWidget from './NoaaWidget';

export default function CosmicCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.45;

      if (baseRadius > 0) {
        // 1. Outer Dashed Orbital Ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 8]);
        ctx.stroke();

        // 2. Middle Rotating Golden Arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.8, angle, angle + Math.PI * 0.85);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.stroke();

        // 3. Inner Counter-Rotating Arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.55, -angle * 1.4, -angle * 1.4 + Math.PI * 0.65);
        ctx.strokeStyle = '#e6ca65';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. Rotating Node Pointer
        const px = centerX + Math.cos(angle) * (baseRadius * 0.8);
        const py = centerY + Math.sin(angle) * (baseRadius * 0.8);
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      angle += 0.006;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0c]">
      
      {/* 1. TOP-LEFT HUD: NOAA GROUND TELEMETRY */}
      <div className="absolute z-20 top-6 left-6 w-80">
        <NoaaWidget />
      </div>

      {/* 2. CENTER: COSMIC CANVAS */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      >
        <canvas 
          ref={canvasRef} 
          className="w-full h-full pointer-events-auto" 
        />
      </div>

      {/* 3. BOTTOM-LEFT HUD: KALI YUGA EPOCH */}
      <div className="absolute bottom-6 left-6 z-20 max-w-sm rounded-lg border border-[#2a2a30] bg-[#121215]/80 p-4 backdrop-blur-md">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono tracking-widest text-[#a38f65] uppercase">
            Current Epoch
          </span>
          <h2 className="text-2xl font-bold tracking-wider text-[#d4af37]">
            KALI YUGA
          </h2>
          <p className="text-xs font-mono text-[#e6ca65]">
            YEAR 5,128 / 432,000
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#2a2a30]">
            <div className="h-full w-[1.18%] bg-[#d4af37]" />
          </div>
          <span className="mt-1 text-[9px] font-mono text-gray-500">
            PROGRESS: 1.1870%
          </span>
        </div>
      </div>

    </div>
  );
}