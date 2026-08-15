'use client';

import React, { useCallback, useRef, useState } from 'react';

interface EqOrbProps {
  size?: number;
  onBassTrebleChange: (bassGain: number, trebleGain: number) => void;
  onVolumeChange: (volumePct: number) => void;
  onPanWidthChange: (width: number) => void;
}

const MAX_SHELF_DB = 8;

// Draggable circular control standing in for the classic slider bank — real
// Web Audio parameters underneath (the existing 60Hz/12kHz BiquadFilterNode
// shelf gains, master volume, and an LFO-modulated StereoPannerNode wired up
// in PodsModule), not a decorative widget. Position resets on remount, same
// as the sliders it replaces.
export default function EqOrb({ size = 160, onBassTrebleChange, onVolumeChange, onPanWidthChange }: EqOrbProps) {
  const orbRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // -1..1 each axis, relative to center
  const draggingRef = useRef(false);

  const applyFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = orbRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width / 2;

      let x = (clientX - cx) / radius;
      let y = (clientY - cy) / radius;
      const dist = Math.sqrt(x * x + y * y);
      if (dist > 1) {
        x /= dist;
        y /= dist;
      }
      setPos({ x, y });

      // X: bass/treble tilt — right = brighter treble + reduced bass, left
      // the opposite. Real BiquadFilterNode shelf gains, not a fake readout.
      onBassTrebleChange(-x * MAX_SHELF_DB, x * MAX_SHELF_DB);
      // Y: master volume — dragging up (negative y) raises it.
      onVolumeChange(Math.round((1 - (y + 1) / 2) * 100));
      // Radial distance: stereo pan width (0..1) — real Web Audio panning,
      // not the "Dolby Spatial Audio" this was originally specced as; that's
      // a licensed product this app has no SDK for.
      onPanWidthChange(Math.min(1, dist));
    },
    [onBassTrebleChange, onVolumeChange, onPanWidthChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    applyFromClient(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    applyFromClient(e.clientX, e.clientY);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const dist = Math.min(1, Math.sqrt(pos.x * pos.x + pos.y * pos.y));

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={orbRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative rounded-full border cursor-grab active:cursor-grabbing touch-none border-neutral-700 bg-slate-950"
        style={{ width: size, height: size }}
      >
        <div className="absolute rounded-full inset-2 border border-slate-800" />
        <div className="absolute rounded-full inset-6 border border-slate-800/60" />
        <div className="absolute w-px h-full bg-slate-800/60 left-1/2 -translate-x-1/2" />
        <div className="absolute w-full h-px bg-slate-800/60 top-1/2 -translate-y-1/2" />

        <div
          className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            left: `${50 + pos.x * 50}%`,
            top: `${50 + pos.y * 50}%`,
            background:
              'radial-gradient(circle at 35% 35%, rgba(216,180,254,1), rgba(139,92,246,0.85) 60%, rgba(139,92,246,0.2))',
            boxShadow: `0 0 ${10 + dist * 20}px rgba(168,85,247,${0.5 + dist * 0.4})`,
          }}
        />
      </div>
      <p className="max-w-[160px] text-center font-mono text-[9px] text-slate-500">
        X: bass/treble · Y: volume · distance: stereo pan width
      </p>
    </div>
  );
}
