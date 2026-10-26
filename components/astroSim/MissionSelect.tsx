'use client';

import { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { MISSIONS } from '@/lib/astroSim/missions';
import type { MissionId } from '@/lib/astroSim/missions';

// The mission list. Missions that are built can be started; the others are
// shown as planned so nobody mistakes them for working features.

export default function MissionSelect({
  completed,
  wide,
  onStart,
  onClose,
}: {
  completed: MissionId[];
  wide: boolean;
  onStart: (id: MissionId) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#04070a]/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Missions">
      <div className="max-w-3xl px-4 py-6 mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-cyan-400 uppercase">Space Drone</p>
            <h2 className="text-lg font-bold text-white">Missions</h2>
          </div>
          <button onClick={onClose} aria-label="Close missions" className="flex items-center justify-center w-9 h-9 border rounded border-neutral-700 text-white/70 hover:text-white hover:border-neutral-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Fly, land, dock, explore. Simulated missions built on the real procedures; every mission is SIM, not a recording of a real flight.</p>

        <ul className="mt-5 space-y-3">
          {MISSIONS.map((m) => {
            const done = completed.includes(m.id);
            const blocked = m.playable && m.wideOnly && !wide;
            return (
              <li key={m.id} className={`p-4 border rounded ${m.playable ? 'border-cyan-500/30 bg-slate-900/60' : 'border-slate-800 bg-slate-900/30 opacity-70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-[0.25em] text-slate-500">MISSION {m.number}</p>
                    <h3 className="text-sm font-bold text-white">{m.title}</h3>
                  </div>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-[0.18em] uppercase border rounded ${
                      done ? 'text-emerald-300 border-emerald-500/50' : m.playable ? 'text-cyan-300 border-cyan-500/50' : 'text-slate-500 border-slate-700'
                    }`}
                  >
                    {done && <Check className="w-3 h-3" />}
                    {done ? 'Complete' : m.playable ? 'Available' : 'Planned'}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{m.blurb}</p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">Based on: {m.basis}</p>
                {m.playable && (
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      disabled={blocked}
                      onClick={() => onStart(m.id)}
                      className="h-8 px-4 text-[11px] uppercase tracking-[0.14em] border rounded border-cyan-500/60 text-cyan-100 enabled:hover:text-white enabled:hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {done ? 'Fly again' : 'Start'}
                    </button>
                    {blocked && <span className="text-[10px] text-amber-300/80">Needs a wider screen (900px or more) for now.</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
