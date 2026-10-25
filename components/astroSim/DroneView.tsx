'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import { RotateCcw, SkipForward } from 'lucide-react';
import type { DroneHud, DroneInputs } from './DroneScene';

const DroneScene = dynamic(() => import('./DroneScene'), { ssr: false });

// On-screen stick: reports x/y in -1..1 (y up-positive) while dragged.
function Stick({ label, color, onChange }: { label: string; color: string; onChange: (x: number, y: number) => void }) {
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
    <div className="text-center">
      <p className="mb-1 text-[10px] tracking-[0.12em] uppercase text-slate-400">{label}</p>
      <div
        ref={pad}
        className="relative w-[104px] h-[104px] rounded-full border border-slate-600 bg-slate-950/70 touch-none cursor-grab"
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
        <div ref={knob} className="absolute w-[38px] h-[38px] -mt-[19px] -ml-[19px] rounded-full pointer-events-none left-1/2 top-1/2" style={{ border: `2px solid ${color}`, background: `${color}33` }} />
      </div>
    </div>
  );
}

export default function DroneView() {
  const [phase, setPhase] = useState<'pad' | 'flight'>('pad');
  const [label, setLabel] = useState('T-3');
  const [cover, setCover] = useState(false);
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState<DroneHud>({ speed: 0, throttle: 0, moonDist: 0 });
  const inputs = useRef<DroneInputs>({ lx: 0, ly: 0, rx: 0, ry: 0 });

  const toFlight = useCallback(() => {
    setCover(true);
    window.setTimeout(() => {
      setPhase('flight');
      setCover(false);
    }, 450);
  }, []);

  const replay = () => {
    setLabel('T-3');
    setPhase('pad');
    setRun((n) => n + 1);
  };

  return (
    <div className="relative flex-1 min-h-0 touch-none select-none">
      <DroneScene key={`${phase}-${run}`} phase={phase} inputs={inputs} onLabel={setLabel} onLaunchDone={toFlight} onHud={setHud} />

      {/* fade between pad and flight */}
      <div className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-500 ${cover ? 'opacity-100' : 'opacity-0'}`} />

      {phase === 'pad' ? (
        <>
          <div className="absolute inset-x-0 text-center pointer-events-none top-[18%]">
            <p className="text-4xl tracking-[0.35em] text-white sm:text-6xl [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]">{label}</p>
          </div>
          <button
            onClick={toFlight}
            className="absolute flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border bottom-4 right-4 bg-slate-900/70 border-neutral-600 text-white/80 hover:text-white"
          >
            <SkipForward className="w-3.5 h-3.5" /> Skip
          </button>
        </>
      ) : (
        <>
          <div className="absolute px-3 py-2 text-[11px] border rounded top-3 left-3 border-cyan-500/30 bg-black/55 text-cyan-100 tabular-nums">
            <p>Speed {hud.speed.toFixed(0)} u/s</p>
            <p>Throttle {Math.round(hud.throttle * 100)}%</p>
            <p>Moon {Math.round(hud.moonDist).toLocaleString()} u</p>
            <p className="mt-1 text-[10px] text-slate-400">Simulated, not to scale</p>
          </div>
          <button
            onClick={replay}
            className="absolute flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border top-3 right-3 bg-slate-900/70 border-neutral-600 text-white/80 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Replay launch
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-5 px-4 py-3 border rounded-2xl bg-slate-950/60 border-slate-700 backdrop-blur">
            <Stick label="Yaw / Throttle" color="#22d3ee" onChange={(x, y) => { inputs.current.lx = x; inputs.current.ly = y; }} />
            <Stick label="Roll / Pitch" color="#fbbf24" onChange={(x, y) => { inputs.current.rx = x; inputs.current.ry = y; }} />
          </div>
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-500">W/S throttle · A/D yaw · arrows pitch and roll · gamepad works too</p>
        </>
      )}
    </div>
  );
}
