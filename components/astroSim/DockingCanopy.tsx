'use client';

import type { DockHud } from './DockingScene';
import type { LedState } from './Led';
import CanopyShell, { NavPanel } from './CanopyShell';
import type { CanopyView } from './CanopyShell';
import type { RadioLine } from '@/lib/astroSim/droneMission';
import { ALIGN_LIMIT, FAR_RANGE, NEAR_RANGE, START_RANGE, SPEED_LIMIT, SWAY_LIMIT } from '@/lib/astroSim/docking';

// Mission 03 (Deep Space Docking) in the canopy cockpit: turns the closing
// telemetry into what the shell draws, plus the alignment scope.

const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

// The drone's offset from the port axis. The middle of the scope is the port; the
// cyan dot is the drone, so slide to bring the dot to the middle. The amber line is
// its sideways drift. The small ring marks the half-metre capture limit.
function AlignScope({ x, y, vx, vy, range }: { x: number; y: number; vx: number; vy: number; range: number }) {
  // distance compresses, so a few centimetres still show up close in
  const scale = (m: number) => 32 * Math.sqrt(Math.min(m, 25) / 25);
  const d = Math.hypot(x, y);
  const r = scale(d);
  const ux = d > 0 ? x / d : 0;
  const uy = d > 0 ? y / d : 0;
  const px = 44 + r * ux;
  const py = 35 - r * uy * 0.8;
  const vd = Math.hypot(vx, vy);
  const vlen = Math.min(18, vd * 60);
  const ex = px + (vd > 0 ? (vx / vd) * vlen : 0);
  const ey = py - (vd > 0 ? (vy / vd) * vlen * 0.8 : 0);
  const lim = scale(ALIGN_LIMIT);
  return (
    <NavPanel label="ALIGNMENT" sub={`X ${signed(x)} Y ${signed(y)} M`}>
      <svg viewBox="0 0 88 70" width="88" height="70" role="img" aria-label={`Offset from the docking port axis at ${range.toFixed(0)} metres`}>
        <ellipse cx="44" cy="35" rx="32" ry="26" fill="none" stroke="rgba(94,233,212,.28)" />
        <ellipse cx="44" cy="35" rx="16" ry="13" fill="none" stroke="rgba(94,233,212,.2)" />
        <line x1="44" y1="6" x2="44" y2="64" stroke="rgba(94,233,212,.15)" />
        <line x1="8" y1="35" x2="80" y2="35" stroke="rgba(94,233,212,.15)" />
        <ellipse cx="44" cy="35" rx={Math.max(2.5, lim)} ry={Math.max(2, lim * 0.8)} fill="none" stroke="#eab308" strokeWidth="1.2" />
        <line x1={px} y1={py} x2={ex} y2={ey} stroke="#eab308" strokeWidth="1.2" />
        <circle cx={px} cy={py} r="2.6" fill="#5ee9d4" style={{ filter: 'drop-shadow(0 0 3px #5ee9d4)', transition: 'cx 150ms linear, cy 150ms linear' }} />
      </svg>
    </NavPanel>
  );
}

export default function DockingCanopy({
  hud,
  assist,
  log,
  onLeft,
  onRight,
  onRetry,
  onToggleAssist,
  onMissions,
}: {
  hud: DockHud;
  assist: boolean;
  log: RadioLine[];
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onRetry: () => void;
  onToggleAssist: () => void;
  onMissions: () => void;
}) {
  const finish = hud.phase === 'docked' || hud.phase === 'crashed';
  const over = hud.closing / Math.max(0.0001, hud.allowed);
  const tone: 'ok' | 'warn' | 'bad' = finish ? 'ok' : over > 1.25 ? 'bad' : over > 1 ? 'warn' : 'ok';
  const fuelLed: LedState = hud.fuel <= 10 ? 'fault' : hud.fuel <= 30 ? 'standby' : 'active';
  const r = hud.result;

  let objective: CanopyView['objective'];
  if (hud.phase === 'rendezvous') {
    objective = {
      title: 'OBJECTIVE 1 · CLOSE THE RANGE · STAY UNDER THE SPEED LIMIT',
      status: `Range ${hud.range.toFixed(0)} m · closing ${hud.closing.toFixed(2)} m/s · allowed ${hud.allowed.toFixed(2)}`,
      fill: Math.max(0, Math.min(1, 1 - (hud.range - FAR_RANGE) / (START_RANGE - FAR_RANGE))),
    };
  } else if (hud.phase === 'approach') {
    objective = {
      title: 'OBJECTIVE 2 · LINE UP THE PORT · CENTRE THE DOT',
      status: `Offset ${hud.offset.toFixed(1)} m · sway ${hud.sway.toFixed(2)} m/s · allowed ${hud.allowed.toFixed(2)}`,
      fill: Math.max(0, Math.min(1, 1 - (hud.range - NEAR_RANGE) / (FAR_RANGE - NEAR_RANGE))),
    };
  } else if (hud.phase === 'final') {
    objective = {
      title: `OBJECTIVE 3 · FINAL CLOSURE · UNDER ${SPEED_LIMIT.toFixed(1)} M/S`,
      status: `Range ${hud.range.toFixed(1)} m · closing ${hud.closing.toFixed(2)} m/s · offset ${hud.offset.toFixed(2)} m`,
      fill: Math.max(0, Math.min(1, 1 - hud.range / NEAR_RANGE)),
    };
  } else {
    objective = { title: hud.phase === 'docked' ? 'MISSION 03 COMPLETE' : 'MISSION 03 FAILED', status: hud.phase === 'docked' ? 'HARD DOCK' : 'CONTACT', fill: hud.phase === 'docked' ? 1 : 0 };
  }

  const reasonText: Record<string, string> = {
    SPEED: `Contact at ${r?.closing.toFixed(2)} m/s: the ports capture at up to ${SPEED_LIMIT.toFixed(1)}.`,
    ALIGN: `Contact ${r?.offset.toFixed(1)} m off the port axis: the ring takes up to ${ALIGN_LIMIT.toFixed(1)}.`,
    SWAY: `Sliding sideways at ${r?.sway.toFixed(2)} m/s at contact: the latches take up to ${SWAY_LIMIT.toFixed(2)}.`,
    LOST: 'The drone drifted out past three hundred metres and the approach was called off.',
  };

  const view: CanopyView = {
    title: { eyebrow: 'SPACE DRONE', name: 'Deep space docking' },
    heading: 0,
    sunGlow: 0,
    t: hud.t,
    throttle: Math.min(1, hud.closing / 1.5),
    linkLost: false,
    objective,
    speed: { label: 'CLOSING RATE', value: hud.closing.toFixed(2), sub: `M/S · ALLOWED ${hud.allowed.toFixed(2)} · SWAY ${hud.sway.toFixed(2)}`, tone },
    tele: [
      { label: 'RANGE', value: hud.range.toFixed(hud.range < 100 ? 1 : 0), unit: 'm' },
      { label: 'CLOSING', value: hud.closing.toFixed(2), unit: 'm/s', warn: over > 1 && !finish },
      { label: 'ALLOWED', value: hud.allowed.toFixed(2), unit: 'm/s' },
      { label: 'OFFSET X', value: signed(hud.x, 1), unit: 'm' },
      { label: 'OFFSET Y', value: signed(hud.y, 1), unit: 'm' },
      { label: 'SWAY', value: hud.sway.toFixed(2), unit: 'm/s', warn: hud.sway > SWAY_LIMIT && hud.range < 20 && !finish },
      { label: 'PROPELLANT', value: hud.fuel.toFixed(0), unit: '%', warn: hud.fuel <= 10 },
      { label: 'RADIO LINK', value: '35', unit: 'dB' },
    ],
    nav: <AlignScope x={hud.x} y={hud.y} vx={hud.vx} vy={hud.vy} range={hud.range} />,
    buttons: [
      { label: 'RATE DAMPING', onClick: onToggleAssist, led: assist ? 'active' : 'off', pressed: assist },
      { label: 'RETRY', onClick: onRetry, led: 'off' },
    ],
    toggles: [
      { label: 'NAV', color: '#34d399', state: 'active' },
      { label: 'COMMS', color: '#34d399', state: 'active' },
      { label: 'CABIN', color: '#34d399', state: 'active' },
      { label: 'LATCH', color: '#eab308', state: hud.phase === 'final' ? 'active' : hud.phase === 'docked' ? 'active' : 'standby' },
      { label: 'RCS', color: '#34d399', state: finish ? 'off' : hud.fuel > 0 ? 'active' : 'fault' },
      { label: 'PWR', color: '#34d399', state: 'active' },
      { label: 'GYRO', color: '#34d399', state: 'active' },
      { label: 'PROP', color: hud.fuel <= 10 ? '#fb7185' : '#eab308', state: fuelLed },
    ],
    done:
      r && r.outcome === 'docked'
        ? {
            kicker: 'MISSION 03',
            title: 'HARD DOCK',
            text: `${r.rating} dock · closing ${r.closing.toFixed(2)} m/s · ${r.offset.toFixed(2)} m off axis · sway ${r.sway.toFixed(2)} m/s · propellant ${hud.fuel.toFixed(0)}%`,
            actions: [
              { label: 'FLY AGAIN', onClick: onRetry },
              { label: 'MISSIONS', onClick: onMissions },
            ],
          }
        : r
          ? {
              kicker: 'MISSION 03',
              title: r.reason === 'LOST' ? 'APPROACH ABORTED' : 'CONTACT',
              tone: 'bad',
              text: `${reasonText[r.reason ?? 'SPEED']} The transponder was not delivered.`,
              actions: [
                { label: 'RETRY', onClick: onRetry },
                { label: 'MISSIONS', onClick: onMissions },
              ],
            }
          : null,
    controls: { caption: 'W/S CLOSE · BRAKE · ARROWS OR A/D SLIDE', left: 'Closing', right: 'Slide' },
  };

  return <CanopyShell view={view} log={log} onLeft={onLeft} onRight={onRight} onMissions={onMissions} />;
}
