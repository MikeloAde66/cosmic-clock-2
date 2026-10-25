'use client';

import { useRef } from 'react';

// On-screen stick: reports x/y in -1..1 (y up-positive) while dragged.
export default function FlightStick({ label, color, onChange }: { label: string; color: string; onChange: (x: number, y: number) => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  const set = (e: React.PointerEvent) => {
    const el = pad.current;
    if (!el || !knob.current) return;
    const r = el.getBoundingClientRect();
    const R = r.width / 2 - 19;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx *= R / d;
      dy *= R / d;
    }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    onChange(dx / R, -dy / R);
  };
  const reset = () => {
    active.current = null;
    if (knob.current) knob.current.style.transform = '';
    onChange(0, 0);
  };

  return (
    <div className="text-center pointer-events-auto">
      <p className="mb-1 text-[9px] tracking-[0.14em] uppercase text-slate-400">{label}</p>
      <div
        ref={pad}
        className="relative w-[96px] h-[96px] sm:w-[104px] sm:h-[104px] rounded-full touch-none cursor-grab"
        style={{
          border: '4px solid transparent',
          background:
            'radial-gradient(circle at 50% 38%, #1b1f25 0%, #07090c 70%) padding-box, linear-gradient(135deg,#f5f7fa 0%,#9aa3ad 18%,#3a4048 38%,#c9ced4 52%,#6c737b 70%,#e8ebee 86%,#555c64 100%) border-box',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.8)',
        }}
        onPointerDown={(e) => {
          active.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === active.current) set(e);
        }}
        onPointerUp={(e) => {
          if (e.pointerId === active.current) reset();
        }}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
      >
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-slate-700/70" />
        <div className="absolute top-1/2 left-2 right-2 h-px bg-slate-800" />
        <div
          ref={knob}
          className="absolute w-[38px] h-[38px] -mt-[19px] -ml-[19px] rounded-full pointer-events-none left-1/2 top-1/2"
          style={{
            background: 'radial-gradient(circle at 35% 28%, #ffffff 0%, #b8c0c8 28%, #4b525a 68%, #14171b 100%)',
            boxShadow: `0 0 0 2px ${color}, 0 0 10px ${color}77, 0 3px 6px rgba(0,0,0,0.7)`,
          }}
        />
      </div>
    </div>
  );
}
