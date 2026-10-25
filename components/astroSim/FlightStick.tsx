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
        className="relative w-[96px] h-[96px] sm:w-[104px] sm:h-[104px] rounded-full border border-slate-600 bg-slate-950/80 touch-none cursor-grab shadow-[inset_0_0_18px_rgba(0,0,0,0.9)]"
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
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-slate-800" />
        <div className="absolute top-1/2 left-2 right-2 h-px bg-slate-800" />
        <div
          ref={knob}
          className="absolute w-[38px] h-[38px] -mt-[19px] -ml-[19px] rounded-full pointer-events-none left-1/2 top-1/2"
          style={{ border: `2px solid ${color}`, background: `${color}33`, boxShadow: `0 0 10px ${color}66` }}
        />
      </div>
    </div>
  );
}
