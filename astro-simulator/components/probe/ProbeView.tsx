'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gauge, Play, RotateCcw, Snowflake, Wind } from 'lucide-react';
import ModeBadge from '@/components/ModeBadge';
import { playAlarm, unlockAudio } from '@/lib/audio';
import {
  PLANETS,
  deployChute,
  gustMs,
  jettisonChute,
  newProbe,
  pressureBar,
  stepProbe,
  type PlanetId,
  type Probe,
} from '@/lib/probe/model';

const WARPS = [10, 60, 240] as const;

function Bar({ label, value, unit, frac, warn }: { label: string; value: string; unit: string; frac: number; warn?: boolean }) {
  return (
    <div className="p-3 border rounded-xl border-slate-800 bg-slate-900/50">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.2em] uppercase text-slate-500">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${warn ? 'text-rose-300' : 'text-white'}`}>
          {value} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
        </span>
      </div>
      <div className="h-1.5 mt-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${warn ? 'bg-rose-400' : 'bg-cyan-400'}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function ProbeView() {
  const [planetId, setPlanetId] = useState<PlanetId>('venus');
  const [warp, setWarp] = useState<number>(60);
  const [running, setRunning] = useState(false);
  // The sim mutates `probe` in place; `snap` is the copy React renders from.
  const probe = useRef<Probe>(newProbe(PLANETS.venus));
  const [snap, setSnap] = useState<Probe>(() => newProbe(PLANETS.venus));
  const planet = PLANETS[planetId];
  const warpRef = useRef(warp);
  const lastAlarm = useRef(0);

  useEffect(() => {
    warpRef.current = warp;
  }, [warp]);

  const reset = useCallback((id: PlanetId) => {
    probe.current = newProbe(PLANETS[id]);
    setRunning(false);
    setSnap({ ...probe.current });
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const pr = probe.current;
      let left = dtReal * warpRef.current;
      while (left > 0 && pr.status === 'descending') {
        const dt = Math.min(1, left);
        stepProbe(pr, PLANETS[planetId], dt);
        left -= dt;
      }
      if (pr.integrity < 40 && pr.status === 'descending' && now - lastAlarm.current > 1500) {
        lastAlarm.current = now;
        playAlarm();
      }
      setSnap({ ...probe.current });
      if (pr.status === 'descending') raf = requestAnimationFrame(loop);
      else setRunning(false);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, planetId]);

  const toggleChute = useCallback(() => {
    const pr = probe.current;
    if (pr.status !== 'descending') return;
    if (pr.chute) jettisonChute(pr);
    else deployChute(pr, PLANETS[planetId]);
    setSnap({ ...probe.current });
  }, [planetId]);

  const toggleCoolant = useCallback(() => {
    probe.current.coolantOn = !probe.current.coolantOn;
    setSnap({ ...probe.current });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleChute();
      } else if (e.code === 'KeyC') toggleCoolant();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleChute, toggleCoolant]);

  const p = snap;
  const bar = pressureBar(planet, p.hKm);
  const ambient = planet.temp(p.hKm);
  const wind = gustMs(planet, p.hKm, p.t);
  const altFrac = (p.hKm - planet.floorKm) / (planet.startKm - planet.floorKm);
  const done = p.status !== 'descending';
  const mm = Math.floor(p.t / 60);

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(Object.keys(PLANETS) as PlanetId[]).map((id) => (
            <button
              key={id}
              onClick={() => {
                setPlanetId(id);
                reset(id);
              }}
              aria-pressed={id === planetId}
              className={`h-8 px-4 text-[11px] uppercase tracking-wide rounded border transition ${id === planetId ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900/50 text-slate-300'}`}
            >
              {PLANETS[id].name}
            </button>
          ))}
        </div>
        <ModeBadge mode="SIM" note="A game. Atmosphere profiles are approximations, not mission data" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">{planet.goal}</p>

      <div className="grid gap-4 mt-5 md:grid-cols-[6rem_minmax(0,1fr)]">
        {/* Altitude strip */}
        <div className="relative hidden h-72 overflow-hidden border rounded-xl md:block border-slate-800 bg-gradient-to-b from-slate-900 to-amber-950/40">
          <div className="absolute w-full px-2 text-center" style={{ top: `${(1 - altFrac) * 88 + 2}%` }}>
            <div className={`mx-auto w-3 h-3 rounded-full ${p.chute ? 'bg-amber-300' : 'bg-cyan-300'} shadow-[0_0_10px_currentColor]`} />
            <p className="mt-1 text-[10px] tabular-nums text-slate-300">{p.hKm.toFixed(1)} km</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Bar label="Pressure" value={bar < 10 ? bar.toFixed(2) : bar.toFixed(1)} unit="bar" frac={bar / planet.hullPressureBar} warn={bar > planet.hullPressureBar} />
          <Bar label="Hull temp" value={p.hullTempK.toFixed(0)} unit="K" frac={p.hullTempK / planet.hullTempK} warn={p.hullTempK > planet.hullTempK} />
          <Bar label="Ambient" value={ambient.toFixed(0)} unit="K" frac={ambient / planet.hullTempK} />
          <Bar label="Wind" value={wind.toFixed(0)} unit="m/s" frac={wind / 200} />
          <Bar label="Descent" value={Math.max(0, p.vMs).toFixed(1)} unit="m/s" frac={p.vMs / 300} />
          <Bar label="Hull integrity" value={p.integrity.toFixed(0)} unit="%" frac={p.integrity / 100} warn={p.integrity < 40} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-5">
        <button
          onClick={() => {
            unlockAudio();
            if (done) reset(planetId);
            else setRunning((r) => !r);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wide uppercase rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
        >
          {done ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {done ? 'Drop again' : running ? 'Pause' : p.t > 0 ? 'Resume' : 'Begin drop'}
        </button>
        <button onClick={toggleChute} disabled={done} className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wide rounded-lg border disabled:opacity-40 ${p.chute ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-300'}`}>
          <Wind className="w-4 h-4" /> {p.chute ? 'Jettison chute' : 'Deploy chute'} <kbd className="text-[10px] text-slate-500">Space</kbd>
        </button>
        <button onClick={toggleCoolant} disabled={done || p.coolant <= 0} className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wide rounded-lg border disabled:opacity-40 ${p.coolantOn ? 'border-cyan-500/60 text-cyan-300 bg-cyan-500/10' : 'border-slate-700 text-slate-300'}`}>
          <Snowflake className="w-4 h-4" /> Coolant {p.coolant.toFixed(0)}% <kbd className="text-[10px] text-slate-500">C</kbd>
        </button>
        <div className="flex items-center gap-1 ml-auto">
          <Gauge className="w-3.5 h-3.5 text-slate-500" />
          {WARPS.map((w) => (
            <button key={w} onClick={() => setWarp(w)} aria-pressed={w === warp} className={`h-8 px-2 text-[11px] rounded border ${w === warp ? 'border-cyan-500/60 text-cyan-300' : 'border-slate-700 text-slate-400'}`}>
              {w}×
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 tabular-nums">
        T+ {mm}m {Math.floor(p.t % 60)}s · deepest {p.maxBar.toFixed(1)} bar · {warp}× time
      </p>

      {done && (
        <div className={`p-4 mt-4 border rounded-xl ${p.status === 'landed' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`}>
          <p className="text-sm font-bold">{p.status === 'landed' ? 'Transmission complete' : 'Signal lost'}</p>
          <p className="mt-1 text-xs text-slate-300">
            {p.status === 'landed' ? `Survived to the surface with ${p.integrity.toFixed(0)}% hull.` : `${p.cause ?? 'Probe lost'} at ${bar.toFixed(1)} bar, ${p.hKm.toFixed(1)} km.`}{' '}
            Deepest: {p.maxBar.toFixed(1)} bar.
          </p>
        </div>
      )}
      <p className="mt-6 text-[11px] text-slate-600">Tip: the chute is gentle and slow; heat and pressure build the longer you fall, but touching down fast breaks the hull.</p>
    </div>
  );
}
