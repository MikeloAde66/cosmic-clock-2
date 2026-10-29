'use client';

import type { RoverHud } from './RoverScene';
import type { LedState } from './Led';
import CanopyShell, { NavPanel } from './CanopyShell';
import type { CanopyView } from './CanopyShell';
import type { RadioLine } from '@/lib/astroSim/droneMission';
import { CRATERS, PITS, RELAY, ROCKS, SAMPLE_R, TARGETS, TILT_WARN, UNSTOW_T, V_MAX } from '@/lib/astroSim/rover';

// Mission 05 (First Rover Drive) in the canopy cockpit: turns the rover's
// telemetry into what the shell draws, with a traverse map on the small screen.

const num = (v: number, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// North-up map of the patch: sand, craters, boulders, the targets and the relay.
function TraverseMap({ hud }: { hud: RoverHud }) {
  const S = 0.5;
  const px = (x: number) => 44 + (x - 45) * S;
  const py = (z: number) => 35 + (z + 37) * S;
  const deg = (hud.heading * 180) / Math.PI;
  const nextIdx = hud.samples.findIndex((d) => !d);
  return (
    <NavPanel label="TRAVERSE" sub={`NEXT ${num(hud.nextDist)} M`}>
      <svg viewBox="0 0 88 70" width="88" height="70" role="img" aria-label="Map of the rover, the science targets and the hazards">
        {PITS.map((p, i) => (
          <circle key={i} cx={px(p.x)} cy={py(p.z)} r={p.r * S} fill="rgba(120,70,40,.45)" />
        ))}
        {CRATERS.map((c, i) => (
          <circle key={i} cx={px(c.x)} cy={py(c.z)} r={c.r * S} fill="none" stroke={c.d / c.r > 0.3 ? 'rgba(251,113,133,.85)' : 'rgba(234,179,8,.45)'} strokeWidth="1" strokeDasharray={c.d / c.r > 0.3 ? undefined : '2 1.5'} />
        ))}
        {ROCKS.map((r, i) => (
          <circle key={i} cx={px(r.x)} cy={py(r.z)} r={Math.max(0.9, r.r * S * 0.8)} fill="rgba(148,163,184,.6)" />
        ))}
        {TARGETS.map((t, i) => (
          <g key={t.name}>
            {i === nextIdx && <circle cx={px(t.x)} cy={py(t.z)} r={SAMPLE_R * S + 2} fill="none" stroke="rgba(234,179,8,.6)" />}
            <circle cx={px(t.x)} cy={py(t.z)} r="2.4" fill={hud.samples[i] ? '#34d399' : '#eab308'} />
          </g>
        ))}
        <rect x={px(RELAY.x) - 2.4} y={py(RELAY.z) - 2.4} width="4.8" height="4.8" transform={`rotate(45 ${px(RELAY.x)} ${py(RELAY.z)})`} fill={hud.uplinked ? '#34d399' : '#5ee9d4'} opacity={nextIdx === -1 ? 1 : 0.55} />
        <g transform={`translate(${px(hud.x)} ${py(hud.z)}) rotate(${deg})`} style={{ filter: 'drop-shadow(0 0 3px #5ee9d4)' }}>
          <polygon points="4,0 -3,-2.6 -3,2.6" fill="#5ee9d4" />
        </g>
      </svg>
    </NavPanel>
  );
}

export default function RoverCanopy({
  hud,
  assist,
  log,
  onLeft,
  onRight,
  onAction,
  onRetry,
  onToggleAssist,
  onMissions,
}: {
  hud: RoverHud;
  assist: boolean;
  log: RadioLine[];
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onAction: () => void;
  onRetry: () => void;
  onToggleAssist: () => void;
  onMissions: () => void;
}) {
  const ph = hud.phase;
  const r = hud.result;
  const got = hud.samples.filter(Boolean).length;
  const health = Math.max(0, 100 - hud.damage);
  const speed = Math.abs(hud.v);
  const battLed: LedState = hud.battery <= 10 ? 'fault' : hud.battery <= 30 ? 'standby' : 'active';
  const bearingDeg = Math.round((hud.nextBearing * 180) / Math.PI);
  const side = Math.abs(bearingDeg) < 8 ? 'AHEAD' : bearingDeg > 0 ? `${bearingDeg}° RIGHT` : `${-bearingDeg}° LEFT`;
  // heading 0 faces +x, which is east on the map; the map's top is north
  const compass = Math.round((((hud.heading * 180) / Math.PI + 90) % 360 + 360) % 360);
  const working = hud.activity !== 'none';

  let objective: CanopyView['objective'];
  let speedCell: CanopyView['speed'];
  let controls: CanopyView['controls'];

  if (ph === 'stowed') {
    objective = {
      title: 'OBJECTIVE 1 · UNSTOW · PRESS SPACE TO DEPLOY WREN',
      status: hud.activity === 'unstow' ? `Unfolding mast and panels · ${Math.ceil(UNSTOW_T * (1 - hud.actFrac))} s` : 'Wren is folded for landing: mast down, panels shut',
      fill: hud.activity === 'unstow' ? hud.actFrac : 0,
    };
    speedCell = { label: 'GROUND SPEED', value: '0.0', sub: 'M/S · STOWED', tone: 'ok' };
    controls = { caption: 'SPACE OR THE UNSTOW BUTTON UNFOLDS THE ROVER', left: 'Drive', right: 'Steer' };
  } else if (ph === 'driving' && !hud.relay) {
    objective = {
      title: `OBJECTIVE 2 · TARGET ${Math.min(3, got + 1)}/3 · ${hud.nextName}`,
      status:
        hud.activity === 'sample'
          ? 'Sampling · hold still'
          : hud.inRange
            ? 'In range · stop, then press Space to sample'
            : `${num(hud.nextDist)} m · ${side}`,
      fill: hud.activity === 'sample' ? (got + hud.actFrac) / 3 : got / 3,
    };
    speedCell = { label: 'GROUND SPEED', value: speed.toFixed(1), sub: `M/S · BATTERY ${num(hud.battery)}%`, tone: hud.tilt > TILT_WARN || health < 40 ? 'bad' : hud.inPit || health < 70 || hud.battery <= 30 ? 'warn' : 'ok' };
    controls = { caption: hud.inRange ? 'STOP, THEN SPACE SAMPLES · HOLD STILL' : 'W/S DRIVE · A/D STEER · AVOID BOULDERS', left: 'Drive', right: 'Steer' };
  } else if (ph === 'driving') {
    objective = {
      title: 'OBJECTIVE 3 · RELAY · SEND THE DATA HOME',
      status: hud.activity === 'uplink' ? 'Uplink in progress · hold still' : hud.inRange ? 'At the relay point · stop, then press Space to uplink' : `Relay point ${num(hud.nextDist)} m · ${side}`,
      fill: hud.activity === 'uplink' ? hud.actFrac : hud.inRange ? 0.05 : 0,
    };
    speedCell = { label: 'GROUND SPEED', value: speed.toFixed(1), sub: `M/S · BATTERY ${num(hud.battery)}%`, tone: hud.tilt > TILT_WARN || health < 40 ? 'bad' : hud.inPit || health < 70 || hud.battery <= 30 ? 'warn' : 'ok' };
    controls = { caption: hud.inRange ? 'STOP, THEN SPACE UPLINKS · HOLD STILL' : 'DRIVE TO THE RELAY POINT · AVOID THE SAND', left: 'Drive', right: 'Steer' };
  } else {
    objective = { title: ph === 'complete' ? 'MISSION 05 COMPLETE' : 'MISSION 05 FAILED', status: ph === 'complete' ? 'DATA IS HOME' : 'WREN IS LOST', fill: ph === 'complete' ? 1 : got / 3 };
    speedCell = { label: 'RESULT', value: ph === 'complete' ? 'HOME' : 'LOST', sub: ph === 'complete' ? 'SAMPLES SENT TO EARTH' : 'ROVER NOT RECOVERED', tone: ph === 'complete' ? 'ok' : 'bad' };
    controls = { caption: ph === 'complete' ? 'WREN HAS SENT EVERYTHING HOME' : 'RETRY OR PICK ANOTHER MISSION', left: 'Drive', right: 'Steer' };
  }

  const tele: CanopyView['tele'] = [
    { label: 'GROUND SPEED', value: speed.toFixed(1), unit: 'm/s' },
    { label: 'HEADING', value: String(compass).padStart(3, '0'), unit: '°' },
    { label: 'TILT', value: hud.tilt.toFixed(0), unit: '°', warn: hud.tilt > TILT_WARN },
    { label: 'BATTERY', value: num(hud.battery), unit: '%', warn: hud.battery <= 30 },
    { label: 'WHEELS', value: num(health), unit: '%', warn: health < 70 },
    { label: 'SAMPLES', value: `${got}/3`, unit: '' },
    { label: hud.relay ? 'RELAY POINT' : 'NEXT STOP', value: num(hud.nextDist), unit: 'm' },
    { label: 'DISTANCE', value: num(hud.distance), unit: 'm' },
  ];

  const ready = ph === 'stowed' ? hud.activity === 'none' : ph === 'driving' && hud.inRange && !working;
  const buttons: CanopyView['buttons'] = [
    { label: ph === 'stowed' ? 'UNSTOW' : hud.relay ? 'UPLINK' : 'SAMPLE', onClick: onAction, led: working ? 'standby' : ready ? 'active' : 'off' },
    { label: 'DRIVE ASSIST', onClick: onToggleAssist, led: assist ? 'active' : 'off', pressed: assist },
    { label: 'RETRY', onClick: onRetry, led: 'off' },
  ];

  const reasonText: Record<string, string> = {
    WHEELS: 'The wheels took too many hard hits from boulders.',
    ROLLOVER: 'Wren tipped over on the steep crater wall.',
    STUCK: 'Wren sat in the soft sand until the wheels dug in.',
    BATTERY: 'The battery ran flat before the data got home.',
  };

  const view: CanopyView = {
    title: { eyebrow: 'SPACE DRONE', name: 'First rover drive' },
    heading: compass,
    sunGlow: 0,
    t: hud.t,
    throttle: clamp01(speed / V_MAX),
    linkLost: false,
    objective,
    speed: speedCell,
    tele,
    nav: <TraverseMap hud={hud} />,
    buttons,
    toggles: [
      { label: 'NAV', color: '#34d399', state: 'active' },
      { label: 'COMMS', color: '#34d399', state: hud.activity === 'uplink' ? 'standby' : 'active' },
      { label: 'PANELS', color: '#34d399', state: ph === 'stowed' ? (hud.activity === 'unstow' ? 'standby' : 'off') : 'active' },
      { label: 'MAST', color: '#34d399', state: ph === 'stowed' ? 'off' : 'active' },
      { label: 'ARM', color: '#eab308', state: hud.activity === 'sample' ? 'active' : 'standby' },
      { label: 'DISH', color: '#5ee9d4', state: hud.activity === 'uplink' ? 'active' : hud.uplinked ? 'standby' : 'off' },
      { label: 'POWER', color: hud.battery <= 10 ? '#fb7185' : '#eab308', state: battLed },
      { label: 'WHEELS', color: health < 40 ? '#fb7185' : '#34d399', state: health < 40 ? 'fault' : health < 70 ? 'standby' : 'active' },
    ],
    done:
      r && r.outcome === 'complete'
        ? {
            kicker: 'MISSION 05',
            title: 'THE DATA IS HOME',
            text: `${r.rating} drive · ${r.samples} samples · battery ${num(r.battery)}% · wheels ${num(Math.max(0, 100 - r.damage))}% · ${num(r.distance)} m driven`,
            actions: [
              { label: 'DRIVE AGAIN', onClick: onRetry },
              { label: 'MISSIONS', onClick: onMissions },
            ],
          }
        : r
          ? {
              kicker: 'MISSION 05',
              title: 'WREN IS LOST',
              tone: 'bad',
              text: `${reasonText[r.reason ?? 'BATTERY']} ${r.samples} of 3 samples were taken.`,
              actions: [
                { label: 'RETRY', onClick: onRetry },
                { label: 'MISSIONS', onClick: onMissions },
              ],
            }
          : null,
    controls,
  };

  return <CanopyShell view={view} log={log} onLeft={onLeft} onRight={onRight} onMissions={onMissions} />;
}
