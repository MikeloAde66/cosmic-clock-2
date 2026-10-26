'use client';

import { useRef } from 'react';

// On-screen stick: reports x/y in -1..1 (y up-positive) while dragged.
export default function FlightStick({
  label,
  color,
  onChange,
  variant = 'chrome',
  side = 'left',
}: {
  label: string;
  color: string;
  onChange: (x: number, y: number) => void;
  /** 'grip' is the game-controller grip in a 150px bezel from the canopy cockpit */
  variant?: 'chrome' | 'grip';
  /** which hand the grip is for: its trigger faces the pilot's hands */
  side?: 'left' | 'right';
}) {
  const grip = variant === 'grip';
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  const set = (e: React.PointerEvent) => {
    const el = pad.current;
    if (!el || !knob.current) return;
    const r = el.getBoundingClientRect();
    const R = r.width / 2 - (grip ? 30 : 19);
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

  if (grip) {
    const rib = [18, 28, 38, 48];
    return (
      <div className="text-center pointer-events-auto">
        <div
          ref={pad}
          className="relative touch-none cursor-grab"
          style={{ width: 150, height: 150, borderRadius: '50%', background: '#0c1113', border: '1px solid #2a3338', boxShadow: 'inset 0 2px 10px rgba(0,0,0,.6)' }}
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
          <div ref={knob} className="absolute pointer-events-none" style={{ left: '50%', top: '50%', width: 58, height: 88, marginLeft: -29, marginTop: -44 }}>
            <div
              style={{
                position: 'relative',
                width: 58,
                height: 88,
                borderRadius: '30px 30px 22px 22px',
                background: 'linear-gradient(100deg,#3a4248 0%,#23282c 45%,#15191c 100%)',
                boxShadow: '0 6px 14px rgba(0,0,0,.6), inset -4px 0 8px rgba(0,0,0,.5), inset 3px 0 6px rgba(255,255,255,.05)',
              }}
            >
              {rib.map((t) => (
                <div key={t} style={{ position: 'absolute', left: 8, right: 8, top: t, height: 2, background: 'rgba(0,0,0,.45)', borderRadius: 1 }} />
              ))}
              <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 34, height: 20, borderRadius: 17, background: 'linear-gradient(160deg,#4a5258,#20252a)' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  [side === 'left' ? 'right' : 'left']: -5,
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%,#ff8a7a,#b32e1e 70%)',
                  boxShadow: '0 0 5px rgba(255,90,60,.7)',
                }}
              />
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[10px] tracking-[0.14em] uppercase" style={{ color: '#7fb3ac' }}>{label}</p>
      </div>
    );
  }

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
