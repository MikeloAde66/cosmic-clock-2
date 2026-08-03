'use client';

import React, { useEffect, useRef } from 'react';
import NoaaWidget from './NoaaWidget';

export default function CosmicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas resolution on resize
    const handleResize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.45;

      // 1. Outer Dashed Orbital Ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();

      // 2. Middle Rotating Arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.75, angle, angle + Math.PI * 0.8);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.stroke();

      // 3. Inner Counter-Rotating Arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.5, -angle * 1.5, -angle * 1.5 + Math.PI * 0.5);
      ctx.strokeStyle = '#e6ca65';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4. Center Node Pointer
      const px = centerX + Math.cos(angle) * (baseRadius * 0.75);
      const py = centerY + Math.sin(angle) * (baseRadius * 0.75);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      angle += 0.005;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#0a0a0c]">
      
      {/* 1. TOP-LEFT: NOAA TELEMETRY */}
      <div className="absolute z-20 top-4 left-6 w-80">
        <NoaaWidget />
      </div>

      {/* 2. CENTER: COSMIC CANVAS ANIMATION & OVERLAY */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
        <canvas ref={canvasRef} className="w-full h-full" />
        
        {/* Center Clock Core Text */}
        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[9px] font-mono tracking-widest text-[#a38f65] uppercase">
            Current Cycle
          </span>
          <h1 className="text-2xl font-bold tracking-widest text-[#d4af37]">
            432,000Y
          </h1>
          <span className="text-[10px] font-mono text-[#e6ca65] opacity-75">
            KALI YUGA
          </span>
        </div>
      </div>

      {/* 3. BOTTOM-LEFT: KALI YUGA EPOCH */}
      <div className="absolute z-20 max-w-md bottom-6 left-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono tracking-widest text-[#a38f65]">
            Current Epoch
          </span>
          <h2 className="text-2xl font-bold tracking-wider text-[#d4af37]">
            KALI YUGA
          </h2>
          <p className="text-xs font-mono text-[#e6ca65]">
            YEAR 5,128 / 432,000
          </p>
        </div>
      </div>

    </div>
  );
}