// Checks the Mars Sky-Crane Landing model and its radio. Run with:
//   node --test tests/mars.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMars, stepMars, predictEntry, X_TARGET, RANGE_OK, G, T_MAX, LAT_ACC, CABLE, CUT_WINDOW, CRANE_ALT, SEP_AUTO } from '../lib/astroSim/mars.ts';
import type { Mars, MarsInput } from '../lib/astroSim/mars.ts';
import { marsStep } from '../lib/astroSim/marsScript.ts';
import type { MarsFacts } from '../lib/astroSim/marsScript.ts';
import { newMission } from '../lib/astroSim/droneMission.ts';

const DT = 1 / 30;
const idle: MarsInput = { lift: 0, thrIn: 0, tx: 0, tz: 0, assist: true, action: false };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const over = (s: Mars) => s.phase === 'landed' || s.phase === 'crashed';

/** The lift setting whose predicted range hits the target. */
function liftForTarget(s: Mars): number {
  let lo = 0.3, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const p = predictEntry(s, mid)!;
    if (p.x < X_TARGET) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A steady pilot for every stage. */
function fly(opts: { lift?: number; sepAlt?: number; cut?: boolean; stopAt?: Mars['phase'] } = {}): Mars {
  const s = newMars();
  s.lift = opts.lift ?? liftForTarget(s);
  for (let n = 0; n < 200000 && !over(s) && s.phase !== opts.stopAt; n++) {
    const inp = { ...idle };
    if (s.phase === 'chute') inp.action = s.y <= (opts.sepAlt ?? 2000);
    if (s.phase === 'powered' || s.phase === 'crane') {
      const wantVy = s.phase === 'crane' ? clamp(-(s.y - 20) * 0.3, -0.6, 0.6) : -clamp(0.07 * (s.y - 18) + 0.4, 0.4, 95);
      const thrWant = clamp((G + 1.6 * (wantVy - s.vy)) / T_MAX, 0, 1);
      inp.thrIn = clamp((thrWant - s.thr) / (0.35 * DT), -1, 1);
      inp.tx = clamp(((clamp(-0.25 * s.x, -14, 14) - s.vx) * 0.8) / LAT_ACC, -1, 1);
      inp.tz = clamp(((clamp(-0.25 * s.z, -14, 14) - s.vz) * 0.8) / LAT_ACC, -1, 1);
      if (s.phase === 'crane' && s.downAt !== null && opts.cut !== false) inp.action = true;
    }
    stepMars(s, inp, DT);
  }
  return s;
}

test('the predictor knows a longer lift flies farther, inside the chute speed limit', () => {
  const s = newMars();
  const a = predictEntry(s, 0.5)!;
  const b = predictEntry(s, 0.9)!;
  assert.ok(b.x > a.x + 50000, 'more lift stretches the range');
  assert.ok(a.speed < 520 && b.speed < 520, 'and both open the chute at a survivable speed');
  const hit = predictEntry(s, liftForTarget(s))!;
  assert.ok(Math.abs(hit.x - X_TARGET) < 1000);
});

test('a steady pilot lands the rover, start to finish', () => {
  const s = fly();
  assert.equal(s.phase, 'landed', JSON.stringify(s.result));
  assert.equal(s.result!.rating, 'PERFECT');
  assert.ok(s.fuel > 30, `the landing should not burn the tanks (fuel ${s.fuel.toFixed(0)})`);
});

test('separating anywhere sensible still lands, a hair low does not leave room to stop', () => {
  for (const sepAlt of [3500, 2500, 1500]) assert.equal(fly({ sepAlt }).phase, 'landed', `sep ${sepAlt}`);
});

test('the backshell lets go by itself near 900 m', () => {
  const s = fly({ sepAlt: 0, stopAt: 'powered' });
  assert.equal(s.phase, 'powered');
  assert.ok(s.y <= SEP_AUTO + 60 && s.y > SEP_AUTO - 120, `auto separation at ${s.y.toFixed(0)} m`);
});

test('too little lift opens the chute too fast', () => {
  const s = fly({ lift: 0.1 });
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'FAST');
});

test('a range far from the target is out of reach', () => {
  const s = fly({ lift: 0.45 });
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'MISS');
});

test('steering hard down overloads the capsule', () => {
  const s = fly({ lift: -1 });
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'OVERLOAD');
});

test('doing nothing in the powered descent hits the ground', () => {
  const s = fly({ stopAt: 'powered' });
  assert.equal(s.phase, 'powered');
  for (let n = 0; n < 60 / DT && !over(s); n++) stepMars(s, { ...idle, thrIn: -1 }, DT);
  assert.equal(s.result!.reason, 'GROUND');
});

test('a landing needs the cords cut in time', () => {
  const s = fly({ cut: false });
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'SNAG');
  assert.ok(CUT_WINDOW > 5);
});

test('the crane only starts low, slow and over the marker', () => {
  const s = fly({ stopAt: 'powered' });
  s.x = 100;
  s.z = 0;
  s.y = CRANE_ALT - 1;
  s.vy = -0.5;
  s.vx = 0;
  stepMars(s, { ...idle, assist: false }, DT);
  assert.equal(s.phase, 'powered', 'too far from the marker for the crane');
  s.x = 5;
  s.thr = 0.4; // near hover so one step does not change the speed much
  stepMars(s, { ...idle, assist: false }, DT);
  assert.equal(s.phase, 'crane');
  stepMars(s, { ...idle, assist: false }, DT);
  assert.equal(s.cable > 0 && s.cable <= CABLE, true);
});

test('swinging the stage too long drops the rover', () => {
  const s = fly({ stopAt: 'crane' });
  assert.equal(s.phase, 'crane');
  for (let n = 0; n < 8 / DT && !over(s); n++) {
    s.vx = 3; // drifting hard
    stepMars(s, { ...idle, assist: false, thrIn: 0 }, DT);
    s.y = Math.max(s.y, 22);
  }
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'SWING');
});

// ------------------------------------------------------------- the radio

const facts: MarsFacts = { t: 0, stage: 'entry', linkLost: false, alt: 125000, g: 0, rangeErr: 0, fuel: 100, down: false, rating: null, reason: null };

test('the briefing arrives first, once, with a gap before the next line', () => {
  const m = newMission();
  assert.equal(marsStep(m, { ...facts, t: 0.5 }).length, 0);
  const a = marsStep(m, { ...facts, t: 2 });
  assert.equal(a.length, 1);
  assert.equal(a[0].who, 'CAPCOM');
  assert.equal(marsStep(m, { ...facts, t: 3 }).length, 0);
});

test('a range off the target gets a hint that says which way to move the lift', () => {
  const m = newMission();
  for (let t = 2; t < 90; t += 6) marsStep(m, { ...facts, t, alt: 100000 });
  const long = marsStep(m, { ...facts, t: 100, alt: 40000, rangeErr: RANGE_OK + 20000 });
  assert.match(long.map((l) => l.text).join(' '), /long.*Lift down/);
  const again = marsStep(m, { ...facts, t: 106, alt: 38000, rangeErr: RANGE_OK + 20000 });
  assert.equal(again.some((l) => /Lift (down|up) to/.test(l.text)), false, 'no repeat within a few seconds');
});

test('every ending has its own lines', () => {
  const endings: Partial<MarsFacts>[] = [
    { stage: 'landed', rating: 'PERFECT' },
    { stage: 'landed', rating: 'GOOD' },
    { stage: 'landed', rating: 'SAFE' },
    ...(['SKIP', 'OVERLOAD', 'FAST', 'MISS', 'GROUND', 'SWING', 'SNAG'] as const).map((reason) => ({ stage: 'crashed' as const, reason })),
  ];
  for (const e of endings) {
    const m = newMission();
    const said: string[] = [];
    for (let t = 2; t < 200; t += 6) for (const l of marsStep(m, { ...facts, t, alt: 0, rangeErr: null, ...e })) said.push(l.text);
    assert.ok(said.length >= 2, JSON.stringify(e));
  }
});
