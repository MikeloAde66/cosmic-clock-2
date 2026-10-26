'use client';

import type { DroneHud } from './DroneScene';
import type { LedState } from './Led';
import CanopyShell, { NavPanel } from './CanopyShell';
import type { CanopyView } from './CanopyShell';
import { objective } from './CockpitHud';
import type { RadioLine } from '@/lib/astroSim/droneMission';

// Mission 01 (Orbit Insertion) in the canopy cockpit: this file only turns the
// flight telemetry into what the shell draws.

// The little orbit map: the body in the middle, two tilted rings, and the
// drone as an amber dot travelling the outer ring as the lap progresses.
function OrbitNav({ lap, hidden }: { lap: number; hidden: boolean }) {
  const phi = (-12 * Math.PI) / 180;
  const theta = (-139 * Math.PI) / 180 + lap * Math.PI * 2;
  const ex = Math.cos(theta) * 43;
  const ey = Math.sin(theta) * 20;
  const x = 43 + ex * Math.cos(phi) - ey * Math.sin(phi);
  const y = 35 + ex * Math.sin(phi) + ey * Math.cos(phi);
  return (
    <NavPanel label="ORBIT NAV" sub={'INCL 11.2\u00B0'}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#cfd2d6,#6b7277 70%)', transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px rgba(200,210,212,.4)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 86, height: 40, border: '1px solid rgba(94,233,212,.55)', borderRadius: '50%', transform: 'translate(-50%,-50%) rotate(-12deg)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 60, height: 26, border: '1px solid rgba(94,233,212,.25)', borderRadius: '50%', transform: 'translate(-50%,-50%) rotate(-12deg)' }} />
      <div style={{ position: 'absolute', left: x - 3, top: y - 3, width: 6, height: 6, borderRadius: '50%', background: '#eab308', boxShadow: '0 0 5px #eab308', opacity: hidden ? 0.2 : 1, transition: 'left 200ms linear, top 200ms linear, opacity 400ms' }} />
    </NavPanel>
  );
}

export default function CanopyHud({
  hud,
  assist,
  log,
  onLeft,
  onRight,
  onReplay,
  onFaceMoon,
  onToggleAssist,
  onRestart,
  onMissions,
  onNext,
}: {
  hud: DroneHud;
  assist: boolean;
  log: RadioLine[];
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onReplay: () => void;
  onFaceMoon: () => void;
  onToggleAssist: () => void;
  onRestart: () => void;
  onMissions: () => void;
  /** start the next mission (Lunar Touchdown) */
  onNext: () => void;
}) {
  const vd = hud.velDelta;
  const sign = hud.tempC > 0 ? '+' : '';
  const lockLed: LedState = hud.stage === 'acquire' ? 'standby' : 'active';
  const commsLed: LedState = hud.linkLost ? 'fault' : 'active';

  const view: CanopyView = {
    title: { eyebrow: 'SPACE DRONE', name: 'Shuttle\u2011class flight' },
    heading: hud.headingDeg,
    sunGlow: hud.sunGlow,
    t: hud.t,
    throttle: hud.throttle,
    linkLost: hud.linkLost,
    objective: objective(hud),
    speed: { label: 'SPEED', value: hud.velKms.toFixed(2), sub: `KM/S \u00B7 V\u0394 ${vd >= 0 ? '+' : '\u2212'}${Math.abs(vd).toFixed(2)}` },
    tele: [
      { label: 'ALTITUDE', value: Math.round(hud.altKm).toLocaleString(), unit: 'km' },
      { label: 'VELOCITY', value: hud.velKms.toFixed(2), unit: 'km/s' },
      { label: 'RANGE \u00B7 CENTRE', value: Math.round(hud.rangeKm).toLocaleString(), unit: 'km' },
      { label: 'SURFACE TEMP', value: `${sign}${Math.round(hud.tempC)}`.replace('-', '\u2212'), unit: '\u00B0C' },
      { label: 'AMBIENT PRESS', value: `${(hud.pressureBar * 1e15).toFixed(1)}E\u221215`, unit: 'bar' },
      { label: 'G\u2011LOAD', value: hud.gLoad.toFixed(2), unit: 'g' },
      { label: 'RADIATION', value: hud.radUsv.toFixed(2), unit: '\u00B5Sv/h' },
      { label: 'RADIO LINK', value: hud.linkLost ? 'LOS' : `${Math.round(hud.linkDb)}`, unit: hud.linkLost ? undefined : 'dB', warn: hud.linkLost },
    ],
    nav: <OrbitNav lap={hud.orbit} hidden={hud.linkLost} />,
    buttons: [
      { label: 'FACE MOON', onClick: onFaceMoon, led: hud.facingDeg < 8 ? 'active' : 'off' },
      { label: 'ORBIT ASSIST', onClick: onToggleAssist, led: assist ? 'active' : 'off', pressed: assist },
      { label: 'REPLAY LAUNCH', onClick: onReplay, led: 'off' },
    ],
    toggles: [
      { label: 'NAV', color: '#34d399', state: 'active' },
      { label: 'COMMS', color: hud.linkLost ? '#fb7185' : '#34d399', state: commsLed },
      { label: 'CABIN', color: '#34d399', state: 'active' },
      { label: 'LOCK', color: '#eab308', state: lockLed },
      { label: 'THERM', color: '#5a656c', state: 'off' },
      { label: 'PWR', color: '#34d399', state: 'active' },
      { label: 'GYRO', color: '#34d399', state: 'active' },
      { label: 'AUX', color: '#5a656c', state: 'off' },
    ],
    done:
      hud.stage === 'done'
        ? {
            kicker: 'MISSION 01',
            title: 'ORBIT COMPLETE',
            text: 'The relay is aligned. The lights stay on.',
            actions: [
              { label: 'FLY AGAIN', onClick: onRestart },
              { label: 'NEXT: LUNAR TOUCHDOWN', onClick: onNext },
            ],
          }
        : null,
    controls: { caption: 'W/S THROTTLE \u00B7 A/D YAW \u00B7 ARROWS PITCH/ROLL', left: 'Yaw / Throttle', right: 'Roll / Pitch' },
  };

  return <CanopyShell view={view} log={log} onLeft={onLeft} onRight={onRight} onMissions={onMissions} />;
}

