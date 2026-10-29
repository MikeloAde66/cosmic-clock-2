// Checks the First Rover Drive model and its radio. Run with:
//   node --test tests/rover.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newRover, stepRover, nextTarget, nearestHazard, terrainH, slopeAt, inPit,
  TARGETS, RELAY, ROCKS, PITS, CRATERS, ROVER_R, UNSTOW_T, SAMPLE_T, UPLINK_T, TILT_MAX,
} from '../lib/astroSim/rover.ts';
import type { Rover, RoverInput } from '../lib/astroSim/rover.ts';
import { roverStep, ROVER_SCRIPT } from '../lib/astroSim/roverScript.ts';
import type { RoverFacts } from '../lib/astroSim/roverScript.ts';
import { newMission } from '../lib/astroSim/droneMission.ts';

const DT = 1 / 30;
const idle: RoverInput = { drive: 0, steer: 0, assist: true, action: false };
const over = (s: Rover) => s.phase === 'complete' || s.phase === 'failed';
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A route around every hazard, in order: leg points up to each stop. */
const ROUTE: [number, number][] = [
  [10, 6], [28, 10], [48, 12], // first target
  [68, 11], [86, 2], [93, -20], [90, -40], // around the steep crater, second target
  [96, -58], [84, -72], [62, -84], [50, -82], // third target
  [44, -63], [20, -58], [-4, -62], // north of the sand, then the relay point
];
const STOPS = [2, 6, 10, 13]; // indexes in ROUTE where the rover stops to work

/** Steer at a point and drive at a speed; returns the input. */
function toward(s: Rover, x: number, z: number, speed: number, assist = true): RoverInput {
  const err = wrap(Math.atan2(z - s.z, x - s.x) - s.heading);
  const steer = Math.max(-1, Math.min(1, err * 2.2));
  const drive = Math.abs(err) > 0.6 ? 0 : speed * (1 - Math.abs(err) / 0.9);
  return { drive, steer, assist, action: false };
}

/** A steady driver: unstow, follow the route, sample, uplink. */
function drive(opts: { stopAfter?: number; speed?: number } = {}): Rover {
  const s = newRover();
  let leg = 0;
  const speed = opts.speed ?? 0.95;
  for (let n = 0; n < 200000 && !over(s); n++) {
    let inp: RoverInput = { ...idle };
    if (s.phase === 'stowed') {
      inp.action = s.activity === 'none';
    } else if (leg < ROUTE.length) {
      const [x, z] = ROUTE[leg];
      const stop = STOPS.includes(leg);
      const d = Math.hypot(x - s.x, z - s.z);
      if (stop && d < 2.5) {
        // arrived: stand still and work
        inp = { ...idle, action: Math.abs(s.v) < 0.2 && s.activity === 'none' };
        const done = leg === 13 ? s.uplinked : s.samples[STOPS.indexOf(leg)];
        if (done) leg++;
      } else {
        inp = toward(s, x, z, stop ? Math.min(speed, 0.2 + d * 0.3) : speed);
        if (!stop && d < 4) leg++;
      }
    }
    stepRover(s, inp, DT);
    if (opts.stopAfter !== undefined && s.samples.filter(Boolean).length >= opts.stopAfter) break;
  }
  return s;
}

test('the route and the stops are clear of every hazard', () => {
  const pts: [number, number][] = [[0, 0], ...ROUTE];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= len; t += 0.5) {
      const x = a[0] + ((b[0] - a[0]) * t) / len;
      const z = a[1] + ((b[1] - a[1]) * t) / len;
      for (const r of ROCKS) assert.ok(Math.hypot(x - r.x, z - r.z) > r.r + ROVER_R + 1, `rock at ${r.x},${r.z} is on the route`);
      assert.ok(!inPit(x, z), `a sand pit is on the route at ${x.toFixed(0)},${z.toFixed(0)}`);
      const tilt = (Math.atan(Math.hypot(slopeAt(x, z).gx, slopeAt(x, z).gz)) * 180) / Math.PI;
      assert.ok(tilt < TILT_MAX - 5, 'the route stays off the steep wall');
    }
  }
  for (const t of [...TARGETS, RELAY]) {
    for (const r of ROCKS) assert.ok(Math.hypot(t.x - r.x, t.z - r.z) > r.r + ROVER_R + 1, `${t.name} is blocked by a rock`);
    for (const p of PITS) assert.ok(Math.hypot(t.x - p.x, t.z - p.z) > p.r + 3, `${t.name} is in the sand`);
    for (const c of CRATERS) assert.ok(Math.hypot(t.x - c.x, t.z - c.z) > c.r + 3, `${t.name} is in a crater`);
  }
});

test('the ground is flat except in the craters, and only the steep one tips the rover', () => {
  assert.equal(terrainH(0, 0), 0);
  assert.ok(terrainH(CRATERS[0].x, CRATERS[0].z) < -6);
  const maxSlope = (c: (typeof CRATERS)[number]) => {
    let m = 0;
    for (let r = 0; r < c.r; r += 0.25) {
      const g = slopeAt(c.x + r, c.z);
      m = Math.max(m, (Math.atan(Math.hypot(g.gx, g.gz)) * 180) / Math.PI);
    }
    return m;
  };
  assert.ok(maxSlope(CRATERS[0]) > TILT_MAX + 4, 'the steep crater is past the tilt limit');
  assert.ok(maxSlope(CRATERS[1]) < TILT_MAX - 8, 'the shallow crater is a safe crossing');
});

test('Wren sits still until she is unstowed, then drives', () => {
  const s = newRover();
  for (let n = 0; n < 60; n++) stepRover(s, { ...idle, drive: 1 }, DT);
  assert.equal(s.x, 0, 'no driving while stowed');
  assert.equal(s.phase, 'stowed');
  stepRover(s, { ...idle, action: true }, DT);
  assert.equal(s.activity, 'unstow');
  for (let n = 0; n < Math.ceil((UNSTOW_T + 1) / DT); n++) stepRover(s, { ...idle, drive: 1 }, DT);
  assert.equal(s.phase, 'driving');
  assert.equal(s.panels, 1);
  for (let n = 0; n < 60; n++) stepRover(s, { ...idle, drive: 1, assist: false }, DT);
  assert.ok(s.x > 3, 'she moves once unstowed');
});

test('steering right turns the heading up; reverse is slower than forward', () => {
  const s = newRover();
  s.phase = 'driving';
  for (let n = 0; n < 30; n++) stepRover(s, { ...idle, steer: 1 }, DT);
  assert.ok(s.heading > 0.5);
  const f = newRover();
  f.phase = 'driving';
  const r = newRover();
  r.phase = 'driving';
  for (let n = 0; n < 150; n++) {
    stepRover(f, { ...idle, drive: 1, assist: false }, DT);
    stepRover(r, { ...idle, drive: -1, assist: false }, DT);
  }
  assert.ok(f.v > 2 && r.v < -0.9 && Math.abs(r.v) < f.v / 2);
});

test('a steady driver samples all three targets and uplinks the data', () => {
  const s = drive();
  assert.equal(s.phase, 'complete', JSON.stringify(s.result));
  assert.deepEqual(s.samples, [true, true, true]);
  assert.ok(s.uplinked);
  assert.equal(s.result?.rating, 'PERFECT');
  assert.equal(s.damage, 0);
  assert.ok(s.battery > 25, `battery left: ${s.battery.toFixed(0)}%`);
  assert.equal(s.aborts, 0);
  assert.ok(s.t > UNSTOW_T + 3 * SAMPLE_T + UPLINK_T && s.t < 600, `took ${s.t.toFixed(0)} s`);
});

test('the targets come in order and the relay only after the third', () => {
  const s = newRover();
  assert.equal(nextTarget(s).index, 0);
  s.samples = [true, false, false];
  assert.equal(nextTarget(s).target.name, TARGETS[1].name);
  s.samples = [true, true, true];
  assert.ok(nextTarget(s).relay);
  // pressing the button at the relay point before the samples does nothing
  const r = newRover();
  r.phase = 'driving';
  r.x = RELAY.x;
  r.z = RELAY.z;
  stepRover(r, { ...idle, action: true }, DT);
  assert.equal(r.activity, 'none');
});

test('sampling needs range and stillness, and moving cancels it', () => {
  const s = newRover();
  s.phase = 'driving';
  stepRover(s, { ...idle, action: true }, DT);
  assert.equal(s.activity, 'none', 'too far from the target');
  s.x = TARGETS[0].x - 3;
  s.z = TARGETS[0].z;
  s.v = 1.5;
  stepRover(s, { ...idle, action: true }, DT);
  assert.equal(s.activity, 'none', 'still rolling');
  s.v = 0;
  stepRover(s, { ...idle, action: true }, DT);
  assert.equal(s.activity, 'sample');
  for (let n = 0; n < 20; n++) stepRover(s, idle, DT);
  assert.equal(s.activity, 'sample');
  stepRover(s, { ...idle, drive: 1 }, DT);
  assert.equal(s.activity, 'none', 'driving cancels the sample');
  assert.equal(s.aborts, 1);
  assert.deepEqual(s.samples, [false, false, false]);
  // and holding still finishes it
  s.x = TARGETS[0].x - 3;
  s.z = TARGETS[0].z;
  s.v = 0;
  stepRover(s, { ...idle, action: true }, DT);
  for (let n = 0; n < Math.ceil((SAMPLE_T + 0.5) / DT); n++) stepRover(s, idle, DT);
  assert.deepEqual(s.samples, [true, false, false]);
});

test('a hard hit on a boulder damages the wheels, and the hazard brake prevents it', () => {
  const rock = ROCKS[0];
  const hit = newRover();
  hit.phase = 'driving';
  hit.heading = Math.atan2(rock.z - hit.z, rock.x - hit.x);
  for (let n = 0; n < 400 && hit.damage === 0; n++) stepRover(hit, { ...idle, drive: 1, assist: false }, DT);
  assert.ok(hit.damage > 20, `damage ${hit.damage}`);
  assert.ok(Math.hypot(hit.x - rock.x, hit.z - rock.z) >= rock.r + ROVER_R - 0.01, 'the rover is not inside the boulder');

  const brake = newRover();
  brake.phase = 'driving';
  brake.heading = hit.heading;
  for (let n = 0; n < 300; n++) stepRover(brake, { ...idle, drive: 1, assist: true }, DT);
  assert.equal(brake.damage, 0);
  assert.ok(Math.hypot(brake.x - rock.x, brake.z - rock.z) < rock.r + ROVER_R + 0.5, 'it rolled up to the boulder and stopped');
});

test('failure: the wheels give out after repeated hard hits', () => {
  const s = newRover();
  s.phase = 'driving';
  s.heading = Math.atan2(ROCKS[0].z, ROCKS[0].x);
  for (let n = 0; n < 4000 && !over(s); n++) stepRover(s, { ...idle, drive: n % 90 < 60 ? 1 : -1, assist: false }, DT);
  assert.equal(s.result?.reason, 'WHEELS');
});

test('failure: driving into the steep crater tips Wren over', () => {
  const c = CRATERS[0];
  const s = newRover();
  s.phase = 'driving';
  s.x = c.x - c.r - 6;
  s.z = c.z;
  for (let n = 0; n < 1200 && !over(s); n++) stepRover(s, { ...idle, drive: 0.7, assist: false }, DT);
  assert.equal(s.result?.reason, 'ROLLOVER');
});

test('the shallow crater can be crossed', () => {
  const c = CRATERS[1];
  const s = newRover();
  s.phase = 'driving';
  s.x = c.x - c.r - 6;
  s.z = c.z;
  for (let n = 0; n < 700; n++) stepRover(s, { ...idle, drive: 1, assist: false }, DT);
  assert.equal(s.phase, 'driving');
  assert.ok(s.x > c.x + c.r, 'drove straight across');
});

test('failure: crawling in soft sand digs the wheels in, and driving through is fine', () => {
  const p = PITS[0];
  const stuck = newRover();
  stuck.phase = 'driving';
  stuck.x = p.x;
  stuck.z = p.z;
  for (let n = 0; n < 600 && !over(stuck); n++) stepRover(stuck, idle, DT);
  assert.equal(stuck.result?.reason, 'STUCK');

  const q = PITS[1];
  const through = newRover();
  through.phase = 'driving';
  through.x = q.x - q.r - 3;
  through.z = q.z;
  for (let n = 0; n < 900; n++) stepRover(through, { ...idle, drive: 1, assist: false }, DT);
  assert.equal(through.phase, 'driving');
  assert.ok(through.x > q.x + q.r, 'crossed the pit at speed');
});

test('failure: the battery runs flat if Wren dithers', () => {
  const s = newRover();
  s.phase = 'driving';
  for (let n = 0; n < 200000 && !over(s); n++) stepRover(s, idle, DT);
  assert.equal(s.result?.reason, 'BATTERY');
  assert.equal(s.battery, 0);
});

test('the hazard finder names what is close', () => {
  assert.equal(nearestHazard({ x: 8, z: 0 })?.kind, 'rock');
  assert.equal(nearestHazard({ x: 120, z: 40 }), null);
  const p = PITS[0];
  assert.equal(nearestHazard({ x: p.x, z: p.z })?.kind, 'pit');
  const c = CRATERS[0];
  assert.equal(nearestHazard({ x: c.x, z: c.z - c.r - 4 })?.kind, 'crater');
});

// ------------------------------------------------------------------ the radio

const facts = (o: Partial<RoverFacts> = {}): RoverFacts => ({
  t: 0, stage: 'stowed', linkLost: false, activity: 'none', samples: 0, nextDist: 50, relay: false, inRange: false,
  battery: 100, damage: 0, tilt: 0, inPit: false, hazard: null, rating: null, reason: null, ...o,
});

test('every radio beat fires once, in a sensible order, and never twice', () => {
  const m = newMission();
  const heard: string[] = [];
  const say = (f: RoverFacts) => {
    for (const l of roverStep(m, f)) heard.push(l.text.slice(0, 30));
  };
  say(facts({ t: 2 }));
  assert.equal(heard.length, 1);
  say(facts({ t: 2.1 }));
  assert.equal(heard.length, 1, 'no talking over itself');
  say(facts({ t: 20 }));
  assert.equal(heard.length, 2, 'the unstow hint');
  say(facts({ t: 30 }));
  say(facts({ t: 40 }));
  assert.equal(heard.length, 2, 'nothing more while stowed');
  say(facts({ t: 50, stage: 'driving', activity: 'unstow' }));
  say(facts({ t: 60, stage: 'driving' }));
  assert.equal(heard.length, 4);
  say(facts({ t: 70, stage: 'driving', hazard: 'rock' }));
  say(facts({ t: 80, stage: 'driving', inRange: true }));
  assert.equal(new Set(heard).size, heard.length);
  assert.equal(heard.length, 6);
});

test('every failure reason has its own line, and so does every rating', () => {
  for (const reason of ['WHEELS', 'ROLLOVER', 'STUCK', 'BATTERY'] as const) {
    const m = newMission();
    m.sent.add('brief1');
    const lines = ROVER_SCRIPT.beats.filter((b) => b.when(facts({ stage: 'failed', reason })) && !b.key.endsWith('cap'));
    assert.equal(lines.length, 1, reason);
  }
  for (const rating of ['PERFECT', 'GOOD', 'SAFE'] as const) {
    const lines = ROVER_SCRIPT.beats.filter((b) => b.when(facts({ stage: 'complete', rating })) && ['perfect', 'good', 'safe'].includes(b.key));
    assert.equal(lines.length, 1, rating);
  }
});

test('the relay beats wait for all three samples', () => {
  const beat = (k: string) => ROVER_SCRIPT.beats.find((b) => b.key === k)!;
  assert.ok(!beat('sample3').when(facts({ stage: 'driving', samples: 2 })));
  assert.ok(beat('sample3').when(facts({ stage: 'driving', samples: 3 })));
  assert.ok(!beat('inrangeRelay').when(facts({ stage: 'driving', relay: false, inRange: true })));
  assert.ok(beat('inrangeRelay').when(facts({ stage: 'driving', relay: true, inRange: true })));
});
