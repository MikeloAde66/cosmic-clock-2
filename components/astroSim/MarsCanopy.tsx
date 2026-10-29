'use client';

import type { MarsHud } from './MarsScene';
import type { LedState } from './Led';
import CanopyShell, { NavPanel } from './CanopyShell';
import type { CanopyView } from './CanopyShell';
import type { RadioLine } from '@/lib/astroSim/droneMission';
import { CABLE, CHUTE_H, CHUTE_V_MAX, CRANE_ALT, CUT_WINDOW, ENTRY_H, RANGE_OK, SEP_AUTO, SITE_RADIUS, SWAY_MAX } from '@/lib/astroSim/mars';

// Mission 04 (Mars Sky-Crane Landing) in the canopy cockpit: turns the entry,
// parachute, descent and crane telemetry into what the shell draws, plus a range
// scope for the entry and a site radar for the powered descent.

const num = (v: number, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Entry: where holding this lift setting would land, against the target. The
// middle is the target, the green band is the easy zone, the dot is the forecast.
function RangeScope({ err, lift }: { err: number | null; lift: number }) {
  const span = 90000;
  const px = err === null ? 44 : 44 + Math.max(-40, Math.min(40, (err / span) * 40 * 1.0));
  const ok = err !== null && Math.abs(err) <= RANGE_OK;
  const band = (RANGE_OK / span) * 40;
  return (
    <NavPanel label="RANGE" sub={err === null ? '— KM' : `${signed(err / 1000, 0)} KM`}>
      <svg viewBox="0 0 88 70" width="88" height="70" role="img" aria-label="Predicted range against the target">
        <rect x={44 - band} y="22" width={band * 2} height="26" fill="rgba(52,211,153,.14)" stroke="rgba(52,211,153,.5)" />
        <line x1="4" y1="35" x2="84" y2="35" stroke="rgba(94,233,212,.3)" />
        <line x1="44" y1="16" x2="44" y2="54" stroke="rgba(234,179,8,.8)" strokeWidth="1.2" />
        <circle cx={px} cy="35" r="3" fill={ok ? '#5ee9d4' : '#fb7185'} style={{ filter: `drop-shadow(0 0 3px ${ok ? '#5ee9d4' : '#fb7185'})`, transition: 'cx 150ms linear' }} />
        <text x="4" y="64" fill="rgba(148,163,184,.8)" fontSize="6" letterSpacing=".08em">SHORT</text>
        <text x="84" y="64" fill="rgba(148,163,184,.8)" fontSize="6" letterSpacing=".08em" textAnchor="end">LONG</text>
        <rect x="4" y="6" width="80" height="3" fill="rgba(148,163,184,.25)" />
        <rect x={4 + ((lift + 1) / 2) * 80 - 1.5} y="4" width="3" height="7" fill="#eab308" />
        <text x="4" y="17" fill="rgba(148,163,184,.8)" fontSize="6" letterSpacing=".08em">LIFT</text>
      </svg>
    </NavPanel>
  );
}

// A top-down view of the descent: the marker in the middle, the drone as a cyan dot
// with its drift as an amber line. Up on the map is the way the drone faces.
function SiteRadar({ x, z, vx, vz }: { x: number; z: number; vx: number; vz: number }) {
  const d = Math.hypot(x, z);
  const rpx = 32 * Math.sqrt(Math.min(d, 1500) / 1500);
  const ux = d > 0 ? z / d : 0;
  const uy = d > 0 ? x / d : 0;
  const px = 44 + rpx * ux;
  const py = 35 - rpx * uy * 0.8;
  const vd = Math.hypot(vx, vz);
  const vlen = Math.min(20, vd * 0.6);
  const ex = px + (vd > 0 ? (vz / vd) * vlen : 0);
  const ey = py - (vd > 0 ? (vx / vd) * vlen * 0.8 : 0);
  return (
    <NavPanel label="SITE RADAR" sub={`FWD ${signed(-x, 0)} RT ${signed(z, 0)} M`}>
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

export default function MarsCanopy({
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
  hud: MarsHud;
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
  const sink = -hud.vy;
  const r = hud.result;
  const blackout = ph === 'entry' && hud.g > 1.5 && hud.alt > 25000;
  const fuelLed: LedState = hud.fuel <= 10 ? 'fault' : hud.fuel <= 30 ? 'standby' : 'active';

  let objective: CanopyView['objective'];
  let speed: CanopyView['speed'];
  let tele: CanopyView['tele'];
  let nav: CanopyView['nav'];
  let controls: CanopyView['controls'];

  if (ph === 'entry') {
    const err = hud.rangeErr;
    objective = {
      title: 'OBJECTIVE 1 · ENTRY · STEER THE RANGE ONTO THE TARGET',
      status: `Alt ${num(hud.alt / 1000, 0)} km · ${num(hud.speed)} m/s · forecast ${err === null ? '—' : `${signed(err / 1000, 0)} km`}`,
      fill: clamp01(1 - (hud.alt - CHUTE_H) / (ENTRY_H - CHUTE_H)),
    };
    speed = { label: 'ENTRY SPEED', value: (hud.speed / 1000).toFixed(2), sub: `KM/S · DECEL ${hud.g.toFixed(1)} G · PEAK ${hud.peakG.toFixed(1)}`, tone: hud.g > 11 ? 'bad' : hud.g > 8 ? 'warn' : 'ok' };
    tele = [
      { label: 'ALTITUDE', value: num(hud.alt / 1000, 1), unit: 'km' },
      { label: 'VELOCITY', value: num(hud.speed), unit: 'm/s' },
      { label: 'DECEL', value: hud.g.toFixed(1), unit: 'g', warn: hud.g > 11 },
      { label: 'LIFT', value: `${hud.lift >= 0 ? '+' : '−'}${Math.round(Math.abs(hud.lift) * 100)}`, unit: '%' },
      { label: 'RANGE ERR', value: err === null ? '—' : signed(err / 1000, 0), unit: 'km', warn: err !== null && Math.abs(err) > RANGE_OK },
      { label: 'CHUTE SPEED', value: hud.predSpeed === null ? '—' : num(hud.predSpeed), unit: 'm/s', warn: hud.predSpeed !== null && hud.predSpeed > CHUTE_V_MAX },
      { label: 'PEAK DECEL', value: hud.peakG.toFixed(1), unit: 'g' },
      { label: 'RADIO LINK', value: blackout ? 'BLACKOUT' : '34', unit: blackout ? '' : 'dB', warn: blackout },
    ];
    nav = <RangeScope err={err} lift={hud.lift} />;
    controls = { caption: 'W/S OR ARROWS UP/DOWN · LIFT UP STRETCHES THE RANGE', left: 'Lift', right: 'Lift' };
  } else if (ph === 'chute') {
    objective = {
      title: 'OBJECTIVE 2 · PARACHUTE · SEPARATE THE BACKSHELL (ABOUT 2 KM)',
      status: `Alt ${num(hud.alt)} m · sink ${num(sink)} m/s · auto-separation at ${SEP_AUTO} m`,
      fill: clamp01(1 - (hud.alt - SEP_AUTO) / (CHUTE_H - SEP_AUTO)),
    };
    speed = { label: 'SINK RATE', value: num(sink), sub: `M/S · ALT ${num(hud.alt)} M · DECEL ${hud.g.toFixed(1)} G`, tone: hud.alt < 1500 ? 'warn' : 'ok' };
    tele = [
      { label: 'ALTITUDE', value: num(hud.alt), unit: 'm' },
      { label: 'VERT SPEED', value: signed(hud.vy, 0), unit: 'm/s' },
      { label: 'GROUND SPEED', value: num(hud.drift), unit: 'm/s' },
      { label: 'DOWNRANGE', value: signed(-hud.x / 1000, 1), unit: 'km' },
      { label: 'PROPELLANT', value: hud.fuel.toFixed(0), unit: '%' },
      { label: 'CHUTE', value: 'OPEN', unit: '' },
      { label: 'DECEL', value: hud.g.toFixed(1), unit: 'g' },
      { label: 'RADIO LINK', value: '36', unit: 'dB' },
    ];
    nav = <SiteRadar x={hud.x} z={hud.z} vx={hud.vx} vz={hud.vz} />;
    controls = { caption: 'SPACE OR THE SEPARATE BUTTON LETS GO OF THE BACKSHELL', left: 'Throttle', right: 'Steer' };
  } else if (ph === 'powered') {
    objective = {
      title: `OBJECTIVE 3 · POWERED DESCENT · HOVER OVER THE MARKER AT ${CRANE_ALT} M`,
      status: `Alt ${num(hud.alt)} m · sink ${sink.toFixed(1)} m/s · drift ${hud.drift.toFixed(1)} · range ${num(hud.siteDist)} m`,
      fill: clamp01(1 - (hud.alt - CRANE_ALT) / 1900),
    };
    speed = { label: 'SINK RATE', value: sink >= 0 ? sink.toFixed(1) : `−${Math.abs(sink).toFixed(1)}`, sub: `M/S · GATE UNDER 2.0 · DRIFT ${hud.drift.toFixed(1)}`, tone: hud.alt < 200 && sink > 2 ? 'warn' : 'ok' };
    tele = [
      { label: 'ALTITUDE', value: num(hud.alt), unit: 'm' },
      { label: 'VERT SPEED', value: signed(hud.vy, 1), unit: 'm/s' },
      { label: 'GROUND SPEED', value: num(hud.drift, hud.drift < 100 ? 1 : 0), unit: 'm/s' },
      { label: 'SITE RANGE', value: num(hud.siteDist), unit: 'm', warn: hud.alt < 80 && hud.siteDist > SITE_RADIUS },
      { label: 'PROPELLANT', value: hud.fuel.toFixed(0), unit: '%', warn: hud.fuel <= 10 },
      { label: 'THRUST', value: String(Math.round((hud.fuel > 0 ? hud.thr : 0) * 100)), unit: '%' },
      { label: 'G‑LOAD', value: ((hud.fuel > 0 ? hud.thr : 0) * 8.5 / 9.81).toFixed(2), unit: 'g' },
      { label: 'RADIO LINK', value: '37', unit: 'dB' },
    ];
    nav = <SiteRadar x={hud.x} z={hud.z} vx={hud.vx} vz={hud.vz} />;
    controls = { caption: 'W/S THROTTLE · ARROWS FORWARD / SIDE', left: 'Throttle', right: 'Steer' };
  } else if (ph === 'crane') {
    objective = {
      title: hud.down ? 'OBJECTIVE 4 · ROVER DOWN · CUT THE CORDS' : 'OBJECTIVE 4 · SKY CRANE · HOLD STILL WHILE THE ROVER GOES DOWN',
      status: hud.down ? `Wheels on Mars · ${CUT_WINDOW} s to cut · swing ${hud.swing.toFixed(1)}/${SWAY_MAX} s` : `Cable ${hud.cable.toFixed(0)}/${CABLE} m · sink ${sink.toFixed(1)} · drift ${hud.drift.toFixed(1)} · swing ${hud.swing.toFixed(1)}/${SWAY_MAX} s`,
      fill: hud.down ? 1 : clamp01(hud.cable / CABLE),
    };
    speed = { label: 'SINK RATE', value: sink >= 0 ? sink.toFixed(1) : `−${Math.abs(sink).toFixed(1)}`, sub: `M/S · KEEP UNDER 1.2 · DRIFT ${hud.drift.toFixed(1)}`, tone: Math.abs(sink) > 1.2 || hud.drift > 1.2 ? 'bad' : 'ok' };
    tele = [
      { label: 'ALTITUDE', value: num(hud.alt, 1), unit: 'm' },
      { label: 'VERT SPEED', value: signed(hud.vy, 1), unit: 'm/s', warn: Math.abs(hud.vy) > 1.2 },
      { label: 'GROUND SPEED', value: hud.drift.toFixed(1), unit: 'm/s', warn: hud.drift > 1.2 },
      { label: 'CABLE OUT', value: hud.cable.toFixed(1), unit: 'm' },
      { label: 'SWING', value: hud.swing.toFixed(1), unit: 's', warn: hud.swing > 1 },
      { label: 'PROPELLANT', value: hud.fuel.toFixed(0), unit: '%', warn: hud.fuel <= 10 },
      { label: 'THRUST', value: String(Math.round((hud.fuel > 0 ? hud.thr : 0) * 100)), unit: '%' },
      { label: 'ROVER', value: hud.down ? 'DOWN' : 'LOWERING', unit: '' },
    ];
    nav = <SiteRadar x={hud.x} z={hud.z} vx={hud.vx} vz={hud.vz} />;
    controls = { caption: 'HOLD THE HOVER · SPACE CUTS THE CORDS ONCE THE ROVER IS DOWN', left: 'Throttle', right: 'Steer' };
  } else {
    objective = { title: ph === 'landed' ? 'MISSION 04 COMPLETE' : 'MISSION 04 FAILED', status: ph === 'landed' ? 'WREN IS ON MARS' : 'LANDING LOST', fill: ph === 'landed' ? 1 : 0 };
    speed = { label: 'RESULT', value: ph === 'landed' ? 'DOWN' : 'LOST', sub: ph === 'landed' ? 'ROVER DELIVERED' : 'ROVER NOT DELIVERED', tone: ph === 'landed' ? 'ok' : 'bad' };
    tele = [
      { label: 'ALTITUDE', value: num(hud.alt), unit: 'm' },
      { label: 'PEAK DECEL', value: hud.peakG.toFixed(1), unit: 'g' },
      { label: 'SITE RANGE', value: num(r?.siteDist ?? hud.siteDist), unit: 'm' },
      { label: 'SWING', value: (r?.swing ?? hud.swing).toFixed(1), unit: 's' },
      { label: 'PROPELLANT', value: (r?.fuel ?? hud.fuel).toFixed(0), unit: '%' },
      { label: 'THRUST', value: '0', unit: '%' },
      { label: 'CABLE OUT', value: hud.cable.toFixed(1), unit: 'm' },
      { label: 'RADIO LINK', value: '37', unit: 'dB' },
    ];
    nav = <SiteRadar x={hud.x} z={hud.z} vx={0} vz={0} />;
    controls = { caption: ph === 'landed' ? 'WREN IS DOWN' : 'RETRY OR PICK ANOTHER MISSION', left: 'Throttle', right: 'Steer' };
  }

  const buttons: CanopyView['buttons'] = [];
  if (ph === 'chute') buttons.push({ label: 'SEPARATE', onClick: onAction, led: 'standby' });
  if (ph === 'crane') buttons.push({ label: 'CUT CORDS', onClick: onAction, led: hud.down ? 'active' : 'off' });
  buttons.push({ label: 'DESCENT ASSIST', onClick: onToggleAssist, led: assist ? 'active' : 'off', pressed: assist });
  if (buttons.length < 3) buttons.push({ label: 'RETRY', onClick: onRetry, led: 'off' });

  const reasonText: Record<string, string> = {
    SKIP: 'The capsule skipped back out of the atmosphere.',
    OVERLOAD: `Deceleration passed the capsule's limit at ${hud.peakG.toFixed(1)} g.`,
    FAST: `Still too fast at ${num(hud.speed)} m/s when the parachute opened: it can take ${CHUTE_V_MAX}.`,
    MISS: 'The target was out of reach when the parachute opened.',
    GROUND: 'The descent stage hit the ground with the rover still on board.',
    SWING: 'The stage moved too much and the rover swung on its cables.',
    SNAG: 'The rover was down, but the cords were never cut in time.',
  };

  const view: CanopyView = {
    title: { eyebrow: 'SPACE DRONE', name: 'Mars sky-crane landing' },
    heading: 0,
    sunGlow: 0,
    t: hud.t,
    throttle: ph === 'entry' ? clamp01((hud.lift + 1) / 2) : ph === 'powered' || ph === 'crane' ? hud.thr : 0,
    linkLost: blackout,
    objective,
    speed,
    tele,
    nav,
    buttons: buttons.slice(0, 3),
    toggles: [
      { label: 'NAV', color: '#34d399', state: 'active' },
      { label: 'COMMS', color: '#34d399', state: blackout ? 'standby' : 'active' },
      { label: 'CABIN', color: '#34d399', state: 'active' },
      { label: 'SHIELD', color: '#eab308', state: ph === 'entry' ? 'active' : 'off' },
      { label: 'CHUTE', color: '#34d399', state: ph === 'chute' ? 'active' : 'off' },
      { label: 'ENGINE', color: '#34d399', state: ph === 'powered' || ph === 'crane' ? (hud.thr > 0.05 && hud.fuel > 0 ? 'active' : 'standby') : 'off' },
      { label: 'CRANE', color: '#eab308', state: ph === 'crane' ? 'active' : 'standby' },
      { label: 'FUEL', color: hud.fuel <= 10 ? '#fb7185' : '#eab308', state: fuelLed },
    ],
    done:
      r && r.outcome === 'landed'
        ? {
            kicker: 'MISSION 04',
            title: 'WREN IS ON MARS',
            text: `${r.rating} landing · ${Math.round(r.siteDist)} m from the marker · swing ${r.swing.toFixed(1)} s · propellant ${r.fuel.toFixed(0)}%`,
            actions: [
              { label: 'FLY AGAIN', onClick: onRetry },
              { label: 'MISSIONS', onClick: onMissions },
            ],
          }
        : r
          ? {
              kicker: 'MISSION 04',
              title: r.reason === 'SKIP' || r.reason === 'OVERLOAD' || r.reason === 'FAST' || r.reason === 'MISS' ? 'ENTRY LOST' : 'LANDING LOST',
              tone: 'bad',
              text: `${reasonText[r.reason ?? 'GROUND']} Rover Wren was lost.`,
              actions: [
                { label: 'RETRY', onClick: onRetry },
                { label: 'MISSIONS', onClick: onMissions },
              ],
            }
          : null,
    controls,
  };

  // the glow of the plasma around the heat shield, behind the cockpit frame
  const glow = ph === 'entry' ? clamp01(hud.g / 6) * (hud.alt > 25000 ? 1 : 0.5) : 0;
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: glow,
          background: 'radial-gradient(ellipse at 50% 85%, rgba(255,150,60,.75) 0%, rgba(255,90,30,.35) 35%, rgba(255,60,20,0) 70%)',
          mixBlendMode: 'screen',
          transition: 'opacity 150ms linear',
        }}
      />
      <CanopyShell view={view} log={log} onLeft={onLeft} onRight={onRight} onMissions={onMissions} />
    </>
  );
}
