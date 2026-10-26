// Checks the Lunar Touchdown descent model. Run with:
//   node --test tests/touchdown.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDescent, stepDescent, horizLimit, viewPitch, MOON_G, T_MAX, HIGH_GATE, START_ALT } from '../lib/astroSim/touchdown.ts';
import type { Descent, DescentInput } from '../lib/astroSim/touchdown.ts';

const DT = 1 / 30;
const idle: DescentInput = { thrIn: 0, tx: 0, tz: 0, assist: true };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Hold the throttle at a setting by nudging it, the way a pilot would. */
function holdThrottle(s: Descent, target: number): number {
  return clamp((target - s.thr) / (0.35 * DT), -1, 1);
}

function runBraking(s: Descent, throttle: number, seconds: number) {
  for (let i = 0; i < seconds / DT && s.phase === 'braking'; i++) stepDescent(s, { ...idle, thrIn: holdThrottle(s, throttle) }, DT);
}

/** A simple autopilot: arrives at the site and settles at a gentle sink rate. */
function fly(s: Descent, opts: { driftX?: number; maxSeconds?: number } = {}) {
  for (let i = 0; i < (opts.maxSeconds ?? 400) / DT && s.phase !== 'landed' && s.phase !== 'crashed'; i++) {
    const wantSink = Math.min(20, 0.05 * s.y + 0.6);
    const aCmd = MOON_G + 1.5 * (-wantSink - s.vy);
    const thrIn = holdThrottle(s, clamp(aCmd / T_MAX, 0, 1));
    const vxWant = opts.driftX ?? -Math.sign(s.x) * Math.min(15, Math.sqrt(2.4 * Math.abs(s.x)));
    const vzWant = -Math.sign(s.z) * Math.min(45, Math.sqrt(2.4 * Math.abs(s.z)));
    const tx = clamp((0.8 * (vxWant - s.vx)) / 2, -1, 1);
    const tz = clamp((0.8 * (vzWant - s.vz)) / 2, -1, 1);
    stepDescent(s, { thrIn, tx, tz, assist: false }, DT);
  }
}

test('the braking burn only progresses with the throttle held high', () => {
  const lazy = newDescent();
  lazy.thr = 0.2;
  runBraking(lazy, 0.2, 20);
  assert.equal(lazy.p, 0);
  const burn = newDescent();
  runBraking(burn, 0.85, 60);
  assert.equal(burn.phase, 'approach');
  assert.ok(Math.abs(burn.y - HIGH_GATE) < 5, `altitude ${burn.y}`);
  assert.ok(Math.abs(burn.z - 3300) < 40, `range ${burn.z}`);
  assert.ok(burn.vz < -60 && burn.vz > -75, `ground speed ${burn.vz}`);
  assert.ok(burn.fuel > 70 && burn.fuel < 90, `fuel ${burn.fuel}`);
});

test('starting speed is about orbital speed', () => {
  const s = newDescent();
  assert.equal(s.y, START_ALT);
  stepDescent(s, idle, DT);
  assert.ok(Math.abs(s.vz) > 1500 && Math.abs(s.vz) < 1900, `speed ${s.vz}`);
});

test('letting the burn lapse sends the ship past the site', () => {
  const s = newDescent();
  runBraking(s, 0.2, 6); // throttle down for a few seconds: no braking, still flying
  runBraking(s, 0.85, 60);
  assert.equal(s.phase, 'approach');
  assert.ok(s.z < 0, `should have overshot, range ${s.z}`);
});

test('with no engine the lander falls and crashes on the sink rate', () => {
  const s = newDescent();
  runBraking(s, 0.85, 60);
  for (let i = 0; i < 400 / DT && s.phase !== 'crashed' && s.phase !== 'landed'; i++) stepDescent(s, { ...idle, thrIn: holdThrottle(s, 0) }, DT);
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result?.reason, 'SINK');
});

test('a steady autopilot lands inside the envelope, near the marker, with fuel left', () => {
  const s = newDescent();
  runBraking(s, 0.85, 60);
  fly(s);
  assert.equal(s.phase, 'landed', JSON.stringify(s.result));
  assert.ok(s.result!.siteDist < 60, `missed by ${s.result!.siteDist}`);
  assert.ok(s.result!.sink <= 2.13, `sink ${s.result!.sink}`);
  assert.ok(s.fuel > 15, `fuel ${s.fuel}`);
  assert.ok(s.t < 240, `took ${s.t}s`);
});

test('too much sideways speed at touchdown is a crash even with a soft sink', () => {
  const s = newDescent();
  runBraking(s, 0.85, 60);
  fly(s, { driftX: 6 });
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result?.reason, 'DRIFT');
});

test('the doghouse: faster sink leaves less room for sideways speed', () => {
  assert.equal(horizLimit(1), 1.22);
  assert.equal(horizLimit(2.13), 1.22);
  assert.ok(horizLimit(2.6) < 1.22 && horizLimit(2.6) > 0);
  assert.equal(horizLimit(3.05), 0);
});

test('running dry in the braking burn is a crash for lack of fuel', () => {
  const s = newDescent();
  s.fuel = 3;
  runBraking(s, 1, 60);
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result?.reason, 'FUEL');
});

test('the camera pitches over between the start and high gate', () => {
  assert.ok(viewPitch(START_ALT) > viewPitch(HIGH_GATE));
  assert.ok(viewPitch(HIGH_GATE) < -0.8);
});

test('the touchdown radio fires each line once and reacts to the outcome', async () => {
  const { newMission, runScript } = await import('../lib/astroSim/droneMission.ts');
  const { TOUCHDOWN_SCRIPT } = await import('../lib/astroSim/touchdownScript.ts');
  const m = newMission();
  const seen: string[] = [];
  let t = 0;
  const base = { linkLost: false, p: 0, alt: 15000, fuel: 90, rating: null, reason: null } as const;
  const run = (patch: object, seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) {
      t += 0.1;
      for (const l of runScript(m, { ...base, stage: 'braking', ...patch, t } as never, TOUCHDOWN_SCRIPT)) seen.push(l.text);
    }
  };
  run({}, 20);
  run({ p: 0.5 }, 8);
  run({ p: 0.8 }, 8);
  run({ stage: 'approach', alt: 1800, p: 1 }, 20);
  run({ stage: 'final', alt: 100, fuel: 12, p: 1 }, 30);
  run({ stage: 'landed', alt: 0, rating: 'SOFT', p: 1 }, 40);
  assert.equal(new Set(seen).size, seen.length, 'no line repeated');
  const all = seen.join('\n');
  assert.match(all, /twelve-oh-two/);
  assert.match(all, /High gate/);
  assert.match(all, /Low gate/);
  assert.match(all, /Bingo fuel/);
  assert.match(all, /Touchdown/);
  assert.match(all, /Sink rate under one metre/);
  assert.doesNotMatch(all, /Impact/);
});
