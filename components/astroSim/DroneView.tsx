'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { ListChecks, SkipForward } from 'lucide-react';
import CanopyHud from './CanopyHud';
import CockpitHud from './CockpitHud';
import DockingCanopy from './DockingCanopy';
import LandingCanopy from './LandingCanopy';
import MissionSelect from './MissionSelect';
import SiteHeader from './SiteHeader';
import type { DroneHud, DroneInputs } from './DroneScene';
import { EMPTY_DOCK_HUD } from './DockingScene';
import type { DockHud } from './DockingScene';
import { EMPTY_LANDING_HUD } from './LandingScene';
import type { LandingHud } from './LandingScene';
import { missionStep, newMission, runScript } from '@/lib/astroSim/droneMission';
import type { RadioLine } from '@/lib/astroSim/droneMission';
import { dockingStep } from '@/lib/astroSim/dockingScript';
import { TOUCHDOWN_SCRIPT } from '@/lib/astroSim/touchdownScript';
import type { MissionId } from '@/lib/astroSim/missions';
import { markComplete, parseProgress, readProgressRaw, subscribeProgress } from '@/lib/astroSim/progress';
import { playTargetLock, unlockAudio } from '@/lib/astroSim/audio';

const DroneScene = dynamic(() => import('./DroneScene'), { ssr: false });
const LandingScene = dynamic(() => import('./LandingScene'), { ssr: false });
const DockingScene = dynamic(() => import('./DockingScene'), { ssr: false });

// The canopy cockpit is laid out for wide screens; narrower ones keep the
// compact cockpit until it gets its own responsive pass.
const WIDE = '(min-width: 900px)';
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const snapshotWide = () => window.matchMedia(WIDE).matches;
const serverWide = () => false;
const serverProgress = () => '';

export default function DroneView() {
  const wide = useSyncExternalStore(subscribeWide, snapshotWide, serverWide);
  const completed = parseProgress(useSyncExternalStore(subscribeProgress, readProgressRaw, serverProgress));
  const [missionId, setMissionId] = useState<MissionId>('m01');
  const [selectOpen, setSelectOpen] = useState(false);
  const [phase, setPhase] = useState<'pad' | 'flight'>('pad');
  const [label, setLabel] = useState('T-3');
  const [cover, setCover] = useState(false);
  const [run, setRun] = useState(0);
  const [assist, setAssist] = useState(true);
  const [log, setLog] = useState<RadioLine[]>([]);
  const mission = useRef(newMission());
  const recorded = useRef(false);
  const [hud, setHud] = useState<DroneHud>({
    speed: 0, throttle: 0, pitchDeg: 0, rollDeg: 0, headingDeg: 0, sunGlow: 0, t: 0, stage: 'acquire', orbit: 0, facingDeg: 0, lock: 0, assisting: false,
    altKm: 1900, velKms: 0, velDelta: 0, rangeKm: 3637, tempC: -18, pressureBar: 3e-15, gLoad: 0, localG: 0.9, radUsv: 0.5, linkDb: 36, linkLost: false,
  });
  const [landing, setLanding] = useState<LandingHud>(EMPTY_LANDING_HUD);
  const [dock, setDock] = useState<DockHud>(EMPTY_DOCK_HUD);
  const inputs = useRef<DroneInputs>({ lx: 0, ly: 0, rx: 0, ry: 0 });

  const onHud = useCallback((h: DroneHud) => {
    setHud(h);
    const lines = missionStep(mission.current, h);
    if (lines.length) {
      setLog((l) => [...l, ...lines].slice(-8));
      playTargetLock(); // a short blip: the radio keyed
    }
    if (h.stage === 'done' && !recorded.current) {
      recorded.current = true;
      markComplete('m01');
    }
  }, []);

  const onLanding = useCallback((h: LandingHud) => {
    setLanding(h);
    const lines = runScript(
      mission.current,
      { t: h.t, stage: h.phase, linkLost: false, p: h.p, alt: h.alt, fuel: h.fuel, rating: h.result?.rating ?? null, reason: h.result?.reason ?? null },
      TOUCHDOWN_SCRIPT,
    );
    if (lines.length) {
      setLog((l) => [...l, ...lines].slice(-8));
      playTargetLock();
    }
    if (h.phase === 'landed' && !recorded.current) {
      recorded.current = true;
      markComplete('m02');
    }
  }, []);

  const onDocking = useCallback((h: DockHud) => {
    setDock(h);
    const lines = dockingStep(mission.current, {
      t: h.t,
      stage: h.phase,
      linkLost: false,
      range: h.range,
      closing: h.closing,
      allowed: h.allowed,
      offset: h.offset,
      fuel: h.fuel,
      rating: h.result?.rating ?? null,
      reason: h.result?.reason ?? null,
    });
    if (lines.length) {
      setLog((l) => [...l, ...lines].slice(-8));
      playTargetLock();
    }
    if (h.phase === 'docked' && !recorded.current) {
      recorded.current = true;
      markComplete('m03');
    }
  }, []);

  const resetRun = useCallback(() => {
    mission.current = newMission();
    recorded.current = false;
    setLog([]);
  }, []);

  const toFlight = useCallback(() => {
    unlockAudio();
    resetRun();
    setCover(true);
    window.setTimeout(() => {
      setPhase('flight');
      setCover(false);
    }, 450);
  }, [resetRun]);

  const startMission = useCallback(
    (id: MissionId) => {
      unlockAudio();
      setSelectOpen(false);
      resetRun();
      Object.assign(inputs.current, { lx: 0, ly: 0, rx: 0, ry: 0, recenter: undefined, resetMission: undefined });
      setCover(true);
      window.setTimeout(() => {
        setMissionId(id);
        setLabel('T-3');
        setPhase(id === 'm01' ? 'pad' : 'flight');
        setLanding(EMPTY_LANDING_HUD);
        setDock(EMPTY_DOCK_HUD);
        setRun((n) => n + 1);
        setCover(false);
      }, 450);
    },
    [resetRun],
  );

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

  const toggleAssist = useCallback(() => {
    setAssist((a) => {
      inputs.current.assist = !a;
      return !a;
    });
  }, []);

  const restartMission = useCallback(() => {
    resetRun();
    inputs.current.resetMission = Date.now();
  }, [resetRun]);

  const retryLanding = useCallback(() => startMission('m02'), [startMission]);
  const retryDocking = useCallback(() => startMission('m03'), [startMission]);

  const replay = () => {
    setLabel('T-3');
    setPhase('pad');
    setRun((n) => n + 1);
  };

  const openMissions = useCallback(() => setSelectOpen(true), []);
  const closeMissions = useCallback(() => setSelectOpen(false), []);

  const m02 = missionId === 'm02';
  const m03 = missionId === 'm03';
  const canopy = wide && phase === 'flight';

  return (
    <>
      {!canopy && (
        <SiteHeader eyebrow="Space Drone" title={m03 ? 'Deep space docking' : m02 ? 'Lunar touchdown' : 'Shuttle-class flight'} mode="SIM" modeNote="Simulated vehicle and flight, Moon not to scale. The Moon surface is NASA imagery." sub />
      )}
      <div className="relative flex-1 min-h-0 touch-none select-none">
        {m03 ? (
          <DockingScene key={`m03-${run}`} inputs={inputs} onHud={onDocking} />
        ) : m02 ? (
          <LandingScene key={`m02-${run}`} inputs={inputs} onHud={onLanding} />
        ) : (
          <DroneScene key={`${phase}-${run}`} phase={phase} inputs={inputs} onLabel={setLabel} onLaunchDone={toFlight} onHud={onHud} />
        )}

        {/* fade between scenes */}
        <div className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-500 ${cover ? 'opacity-100' : 'opacity-0'}`} />

        {m03 ? (
          wide ? (
            <DockingCanopy hud={dock} assist={assist} log={log} onLeft={onLeft} onRight={onRight} onRetry={retryDocking} onToggleAssist={toggleAssist} onMissions={openMissions} />
          ) : (
            <p className="absolute inset-x-6 text-center text-[12px] text-amber-300/90 top-1/3">Deep Space Docking needs a wider window (900px or more) for now.</p>
          )
        ) : m02 ? (
          wide ? (
            <LandingCanopy hud={landing} assist={assist} log={log} onLeft={onLeft} onRight={onRight} onRetry={retryLanding} onToggleAssist={toggleAssist} onMissions={openMissions} />
          ) : (
            <p className="absolute inset-x-6 text-center text-[12px] text-amber-300/90 top-1/3">Lunar Touchdown needs a wider window (900px or more) for now.</p>
          )
        ) : phase === 'pad' ? (
          <>
            <div className="absolute inset-x-0 text-center pointer-events-none top-[18%]">
              <p className="text-4xl tracking-[0.35em] text-white sm:text-6xl [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]">{label}</p>
            </div>
            <div className="absolute flex items-center gap-2 bottom-4 right-4">
              <button
                onClick={openMissions}
                className="flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border bg-slate-900/70 border-neutral-600 text-white/80 hover:text-white"
              >
                <ListChecks className="w-3.5 h-3.5" /> Missions
              </button>
              <button
                onClick={toFlight}
                className="flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border bg-slate-900/70 border-neutral-600 text-white/80 hover:text-white"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip
              </button>
            </div>
          </>
        ) : wide ? (
          <CanopyHud
            hud={hud}
            assist={assist}
            log={log}
            onLeft={onLeft}
            onRight={onRight}
            onReplay={replay}
            onFaceMoon={faceMoon}
            onToggleAssist={toggleAssist}
            onRestart={restartMission}
            onMissions={openMissions}
            onNext={() => startMission('m02')}
          />
        ) : (
          <CockpitHud hud={hud} assist={assist} log={log} onLeft={onLeft} onRight={onRight} onReplay={replay} onFaceMoon={faceMoon} onToggleAssist={toggleAssist} onRestart={restartMission} />
        )}

        {selectOpen && <MissionSelect completed={completed} wide={wide} onStart={startMission} onClose={closeMissions} />}
      </div>
    </>
  );
}
