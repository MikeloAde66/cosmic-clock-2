'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';
import CockpitHud from './CockpitHud';
import type { DroneHud, DroneInputs } from './DroneScene';

const DroneScene = dynamic(() => import('./DroneScene'), { ssr: false });

export default function DroneView() {
  const [phase, setPhase] = useState<'pad' | 'flight'>('pad');
  const [label, setLabel] = useState('T-3');
  const [cover, setCover] = useState(false);
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState<DroneHud>({ speed: 0, throttle: 0, moonDist: 0, pitchDeg: 0, rollDeg: 0, headingDeg: 0, sunGlow: 0 });
  const inputs = useRef<DroneInputs>({ lx: 0, ly: 0, rx: 0, ry: 0 });

  const toFlight = useCallback(() => {
    setCover(true);
    window.setTimeout(() => {
      setPhase('flight');
      setCover(false);
    }, 450);
  }, []);

  const onLeft = useCallback((x: number, y: number) => {
    inputs.current.lx = x;
    inputs.current.ly = y;
  }, []);
  const onRight = useCallback((x: number, y: number) => {
    inputs.current.rx = x;
    inputs.current.ry = y;
  }, []);

  const faceMoon = useCallback(() => {
    inputs.current.recenter = Date.now();
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
        <CockpitHud hud={hud} onLeft={onLeft} onRight={onRight} onReplay={replay} onFaceMoon={faceMoon} />
      )}
    </div>
  );
}
