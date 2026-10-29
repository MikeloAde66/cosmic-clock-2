// Checks the Deep Space Docking model and its radio. Run with:
//   node --test tests/docking.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDock, stepDock, speedCorridor, phaseOf, THRUST, START_RANGE, LOST_RANGE, SPEED_LIMIT } from '../lib/astroSim/docking.ts';
import type { Dock, DockInput } from '../lib/astroSim/docking.ts';
import { dockingStep } from '../lib/astroSim/dockingScript.ts';
import { newMission } from '../lib/astroSim/droneMission.ts';
import type { DockingFacts } from '../lib/astroSim/dockingScript.ts';

const DT = 1 / 30;
const idle: DockInput = { close: 0, sx: 0, sy: 0, assist: true };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A steady pilot: slides onto the axis and follows the speed corridor down to a gentle contact. */
function autopilot(s: Dock, maxSeconds = 400, closeBias = 0): void {
  for (let i = 0; i < maxSeconds / DT && s.phase !== 'docked' && s.phase !== 'crashed'; i++) {
    const wantVx = clamp(-0.4 * s.x, -0.5, 0.5);
    const wantVy = clamp(-0.4 * s.y, -0.5, 0.5);
    const sx = clamp((wantVx - s.vx) / (THRUST * 0.6), -1, 1);
    const sy = clamp((wantVy - s.vy) / (THRUST * 0.6), -1, 1);
    const want = Math.max(0.05 + closeBias, speedCorridor(s.z) * 0.6);
    const close = clamp(((-s.vz) < want ? 1 : -1) * Math.min(1, Math.abs(want + s.vz) / 0.3 + 0.05), -1, 1);
    stepDock(s, { close, sx, sy, assist: true }, DT);
  }
}

test('the speed corridor tightens with range', () => {
  assert.ok(speedCorridor(40) > speedCorridor(20));
  assert.ok(speedCorridor(20) > speedCorridor(10));
  assert.ok(speedCorridor(2) >= 0.08, 'there is always a floor so the final inch can be flown');
  assert.ok(speedCorridor(10) <= 0.5, 'and by ten metres it is down to a few tenths');
  assert.ok(speedCorridor(1000) <= 1.5, 'and a ceiling on the fast part');
});

test('phases follow the range', () => {
  assert.equal(phaseOf(100), 'rendezvous');
  assert.equal(phaseOf(40), 'approach');
  assert.equal(phaseOf(5), 'final');
});

test('doing nothing ends in a crash, not a free dock', () => {
  const s = newDock();
  for (let i = 0; i < 400 / DT && s.phase !== 'docked' && s.phase !== 'crashed'; i++) stepDock(s, idle, DT);
  assert.equal(s.phase, 'crashed');
  assert.ok(s.result && s.result.reason);
});

test('a steady pilot docks cleanly', () => {
  const s = newDock();
  autopilot(s);
  assert.equal(s.phase, 'docked', JSON.stringify(s.result));
  assert.ok(s.result!.closing <= SPEED_LIMIT);
  assert.ok(s.result!.offset <= 0.5);
  assert.ok(s.fuel > 10, `the approach should not burn the tanks (fuel ${s.fuel.toFixed(1)})`);
});

test('arriving too fast is a speed crash', () => {
  const s = newDock();
  s.x = 0;
  s.y = 0;
  s.vx = 0;
  s.vy = 0;
  s.z = 30;
  s.vz = -1.0;
  for (let i = 0; i < 200 / DT && s.phase !== 'docked' && s.phase !== 'crashed'; i++) stepDock(s, idle, DT);
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'SPEED');
});

test('arriving off the axis is an alignment crash', () => {
  const s = newDock();
  s.x = 3;
  s.y = 0;
  s.vx = 0;
  s.vy = 0;
  s.z = 4;
  s.vz = -0.1;
  for (let i = 0; i < 100 / DT && s.phase !== 'docked' && s.phase !== 'crashed'; i++) stepDock(s, idle, DT);
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'ALIGN');
});

test('arriving on the axis but sliding sideways is a sway crash', () => {
  const s = newDock();
  s.x = 0.05;
  s.y = 0;
  s.vx = 0.3;
  s.vy = 0;
  s.vz = -0.1;
  s.z = 0.05;
  stepDock(s, { ...idle, assist: false }, 1); // one step carries it across the port plane
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'SWAY');
});

test('braking all the way and drifting off ends the approach', () => {
  const s = newDock();
  s.vz = 0.8; // opening
  for (let i = 0; i < 600 / DT && s.phase !== 'crashed'; i++) stepDock(s, idle, DT);
  assert.equal(s.phase, 'crashed');
  assert.equal(s.result!.reason, 'LOST');
  assert.ok(s.z >= LOST_RANGE);
});

test('rate damping bleeds sideways drift when the sticks are idle, and only then', () => {
  const on = newDock();
  const off = newDock();
  for (let i = 0; i < 20 / DT; i++) {
    stepDock(on, { ...idle, assist: true }, DT);
    stepDock(off, { ...idle, assist: false }, DT);
  }
  assert.ok(Math.abs(on.vx) < Math.abs(off.vx), 'assist should slow the drift');
  assert.ok(Math.abs(off.vx - 0.12) < 1e-9, 'without assist the drift is untouched');
});

test('thrust uses fuel, and with no fuel the thrusters do nothing', () => {
  const s = newDock();
  stepDock(s, { close: 1, sx: 1, sy: 0, assist: false }, 1);
  assert.ok(s.fuel < 100);
  s.fuel = 0;
  const vz = s.vz;
  for (let i = 0; i < 60; i++) stepDock(s, { close: 1, sx: 0, sy: 0, assist: false }, DT);
  assert.ok(Math.abs(s.vz - vz) < 0.15, 'only the stick that was still easing out can have an effect');
});

test('the start is where the brief says it is', () => {
  const s = newDock();
  assert.equal(s.z, START_RANGE);
  assert.equal(s.phase, 'rendezvous');
});

// ------------------------------------------------------------- the radio

const facts: DockingFacts = { t: 0, stage: 'rendezvous', linkLost: false, range: 120, closing: 1.5, allowed: 1.5, offset: 16, fuel: 100, rating: null, reason: null };

test('the briefing arrives first, once, and lines never talk over each other', () => {
  const m = newMission();
  assert.equal(dockingStep(m, { ...facts, t: 0.5 }).length, 0);
  const a = dockingStep(m, { ...facts, t: 2 });
  assert.equal(a.length, 1);
  assert.equal(a[0].who, 'CAPCOM');
  assert.equal(dockingStep(m, { ...facts, t: 3 }).length, 0);
});

test('closing too fast gets a warning, not a flood of them', () => {
  const m = newMission();
  // burn through the briefing first
  let t = 2;
  for (; t < 40; t += 6) dockingStep(m, { ...facts, t, closing: 0.4, range: 150 });
  // the scripted beats for this stretch come first, then the warning
  for (; t < 90; t += 6) dockingStep(m, { ...facts, t, closing: 0.2, allowed: 0.5, range: 40, stage: 'approach' });
  const nag = dockingStep(m, { ...facts, t: 100, closing: 1.2, allowed: 0.5, range: 40, stage: 'approach' });
  assert.match(nag.map((l) => l.text).join(' '), /Brake/);
  const again = dockingStep(m, { ...facts, t: 106, closing: 1.2, allowed: 0.5, range: 36, stage: 'approach' });
  assert.equal(again.some((l) => /Brake/.test(l.text)), false, 'no second warning a few seconds later');
});

test('every ending has a line, and each rating its own', () => {
  for (const [stage, extra] of [
    ['docked', { rating: 'SMOOTH' as const }],
    ['docked', { rating: 'GOOD' as const }],
    ['docked', { rating: 'FIRM' as const }],
    ['crashed', { reason: 'SPEED' as const }],
    ['crashed', { reason: 'ALIGN' as const }],
    ['crashed', { reason: 'SWAY' as const }],
    ['crashed', { reason: 'LOST' as const }],
  ] as const) {
    const m = newMission();
    const said: string[] = [];
    for (let t = 2; t < 200; t += 6) for (const l of dockingStep(m, { ...facts, t, stage, range: 0, closing: 0.1, allowed: 0.04, ...extra })) said.push(l.text);
    assert.ok(said.length >= 2, `${stage} ${JSON.stringify(extra)} should get lines`);
  }
});
