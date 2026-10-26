'use client';

import type { LandingHud } from './LandingScene';
import { THRUST_G } from './LandingScene';
import type { LedState } from './Led';
import CanopyShell, { NavPanel } from './CanopyShell';
import type { CanopyView } from './CanopyShell';
import type { RadioLine } from '@/lib/astroSim/droneMission';
import { SINK_FLAT, SINK_LIMIT, LOW_GATE } from '@/lib/astroSim/touchdown';

// Mission 02 (Lunar Touchdown) in the canopy cockpit: turns the descent
// telemetry into what the shell draws, plus the landing-site radar.

const num = (v: number, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

// A top-down view: the marker in the middle, the drone as a cyan dot with its
// velocity as an amber line. Map up is the direction of travel.
function SiteRadar({ x, z, vx, vz }: { x: number; z: number; vx: number; vz: number }) {
  const d = Math.hypot(x, z);
  const rpx = 32 * Math.sqrt(Math.min(d, 3500) / 3500);
  const ux = d > 0 ? x / d : 0;
  const uz = d > 0 ? z / d : 0;
  const px = 44 + rpx * ux;
  const py = 35 + rpx * uz * 0.8;
  const vlen = Math.min(20, Math.hypot(vx, vz) * 0.35);
  const vd = Math.hypot(vx, vz);
  const ex = px + (vd > 0 ? (vx / vd) * vlen : 0);
  const ey = py + (vd > 0 ? (vz / vd) * vlen * 0.8 : 0);
  return (
    <NavPanel label="SITE RADAR" sub={`ΔX ${signed(x, 0)} ΔZ ${signed(-z, 0)} M`}>
      <svg viewBox="0 0 88 70" width="88" height="70" role="img" aria-label="Position relative to the landing marker">
        <ellipse cx="44" cy="35" rx="32" ry="26" fill="none" stroke="rgba(94,233,212,.28)" />
        <ellipse cx="44" cy="35" rx="16" ry="13" fill="none" stroke="rgba(94,233,212,.2)" />
        <line x1="44" y1="6" x2="44" y2="64" stroke="rgba(94,233,212,.15)" />
        <line x1="8" y1="35" x2="80" y2="35" stroke="rgba(94,233,212,.15)" />
        <circle cx="44" cy="35" r="3.2" fill="none" stroke="#eab308" strokeWidth="1.2" />
        <line x1={px} y1={py} x2={ex} y2={ey} stroke="#eab308" strokeWidth="1.2" />
        <circle cx={px} cy={py} r="2.6" fill="#5ee9d4" style={{ filter: 'drop-shadow(0 0 3px #5ee9d4)', transition: 'cx 150ms linear, cy 150ms linear' }} />
      </svg>
    </NavPanel>
  );
}

export default function LandingCanopy({
  hud,
  assist,
  log,
  onLeft,
  onRight,
  onRetry,
  onToggleAssist,
  onMissions,
}: {
  hud: LandingHud;
  assist: boolean;
  log: RadioLine[];
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onRetry: () => void;
  onToggleAssist: () => void;
  onMissions: () => void;
}) {
  const sink = -hud.vy;
  const finish = hud.phase === 'landed' || hud.phase === 'crashed';
  const near = hud.alt < 320 && !finish;
  const tone: 'ok' | 'warn' | 'bad' = near ? (sink > SINK_LIMIT ? 'bad' : sink > SINK_FLAT ? 'warn' : 'ok') : 'ok';
  const fuelLed: LedState = hud.fuel <= 15 ? 'fault' : hud.fuel <= 30 ? 'standby' : 'active';
  const r = hud.result;

  let objective: CanopyView['objective'];
  if (hud.phase === 'braking') {
    objective = { title: 'OBJECTIVE 1 · BRAKE · THROTTLE ABOVE 75%', status: `Ground speed ${num(hud.drift)} m/s · altitude ${num(hud.alt / 1000, 1)} km`, fill: hud.p };
  } else if (hud.phase === 'approach') {
    objective = {
      title: 'OBJECTIVE 2 · HIGH GATE · FLY TO THE MARKER',
      status: `Range ${num(hud.siteDist)} m · alt ${num(hud.alt)} m · sink ${sink.toFixed(1)} m/s`,
      fill: Math.max(0, Math.min(1, 1 - hud.siteDist / 3300)),
    };
  } else if (hud.phase === 'final') {
    objective = {
      title: 'OBJECTIVE 3 · LOW GATE · LAND UNDER 3.0 M/S',
      status: `Alt ${num(hud.alt)} m · sink ${sink.toFixed(1)} m/s · drift ${hud.drift.toFixed(1)} m/s`,
      fill: Math.max(0, Math.min(1, 1 - hud.alt / LOW_GATE)),
    };
  } else {
    objective = { title: hud.phase === 'landed' ? 'MISSION 02 COMPLETE' : 'MISSION 02 FAILED', status: hud.phase === 'landed' ? 'TOUCHDOWN' : 'IMPACT', fill: hud.phase === 'landed' ? 1 : 0 };
  }

  const reasonText: Record<string, string> = {
    SINK: `Sink rate ${r?.sink.toFixed(1)} m/s at contact: the gear takes up to 3.0.`,
    DRIFT: `Ground speed ${r?.drift.toFixed(1)} m/s at contact: the gear takes about 1.2 sideways.`,
    FUEL: 'The tanks ran dry before touchdown.',
  };

  const view: CanopyView = {
    title: { eyebrow: 'SPACE DRONE', name: 'Lunar touchdown' },
    heading: 0,
    sunGlow: 0,
    t: hud.t,
    throttle: hud.thr,
    linkLost: false,
    objective,
    speed: { label: 'SINK RATE', value: sink >= 0 ? sink.toFixed(1) : `−${Math.abs(sink).toFixed(1)}`, sub: `M/S · LIMIT 3.0 · DRIFT ${hud.drift.toFixed(1)}`, tone },
    tele: [
      { label: 'ALTITUDE', value: num(hud.alt), unit: 'm' },
      { label: 'VERT SPEED', value: signed(hud.vy, 1), unit: 'm/s' },
      { label: 'GROUND SPEED', value: num(hud.drift, hud.drift < 100 ? 1 : 0), unit: 'm/s' },
      { label: 'SITE RANGE', value: num(hud.siteDist), unit: 'm' },
      { label: 'FUEL', value: hud.fuel.toFixed(0), unit: '%', warn: hud.fuel <= 15 },
      { label: 'THRUST', value: String(Math.round((hud.fuel > 0 ? hud.thr : 0) * 100)), unit: '%' },
      { label: 'G‑LOAD', value: ((hud.fuel > 0 ? hud.thr : 0) * THRUST_G).toFixed(2), unit: 'g' },
      { label: 'RADIO LINK', value: '37', unit: 'dB' },
    ],
    nav: <SiteRadar x={hud.x} z={hud.z} vx={hud.vx} vz={hud.vz} />,
    buttons: [
      { label: 'LANDING ASSIST', onClick: onToggleAssist, led: assist ? 'active' : 'off', pressed: assist },
      { label: 'RETRY', onClick: onRetry, led: 'off' },
    ],
    toggles: [
      { label: 'NAV', color: '#34d399', state: 'active' },
      { label: 'COMMS', color: '#34d399', state: 'active' },
      { label: 'CABIN', color: '#34d399', state: 'active' },
      { label: 'RADAR', color: '#eab308', state: hud.phase === 'final' ? 'active' : 'standby' },
      { label: 'ENGINE', color: '#34d399', state: finish ? 'off' : hud.thr > 0.05 && hud.fuel > 0 ? 'active' : 'standby' },
      { label: 'PWR', color: '#34d399', state: 'active' },
      { label: 'GYRO', color: '#34d399', state: 'active' },
      { label: 'FUEL', color: hud.fuel <= 15 ? '#fb7185' : '#eab308', state: fuelLed },
    ],
    done:
      r && r.outcome === 'landed'
        ? {
            kicker: 'MISSION 02',
            title: 'TOUCHDOWN',
            text: `${r.rating} landing · sink ${r.sink.toFixed(1)} m/s · drift ${r.drift.toFixed(1)} m/s · ${r.siteDist.toFixed(0)} m from the marker · fuel ${hud.fuel.toFixed(0)}%`,
            actions: [
              { label: 'FLY AGAIN', onClick: onRetry },
              { label: 'MISSIONS', onClick: onMissions },
            ],
          }
        : r
          ? {
              kicker: 'MISSION 02',
              title: 'IMPACT',
              tone: 'bad',
              text: `${reasonText[r.reason ?? 'SINK']} The pod was lost, ${r.siteDist.toFixed(0)} m from the marker.`,
              actions: [
                { label: 'RETRY', onClick: onRetry },
                { label: 'MISSIONS', onClick: onMissions },
              ],
            }
          : null,
    controls: { caption: 'W/S THROTTLE · ARROWS OR A/D MOVE', left: 'Throttle', right: 'Lateral' },
  };

  return <CanopyShell view={view} log={log} onLeft={onLeft} onRight={onRight} onMissions={onMissions} />;
}
