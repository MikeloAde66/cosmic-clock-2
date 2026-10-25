// Checks the Space Drone's mission script. Run with:
//   node --test tests/droneMission.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMission, missionStep } from '../lib/astroSim/droneMission.ts';
import type { MissionFacts } from '../lib/astroSim/droneMission.ts';

const base: MissionFacts = { t: 0, stage: 'acquire', orbit: 0, altKm: 1900, facingDeg: 30, linkLost: false };

test('the briefing arrives at the start, once, with a gap before the next line', () => {
  const m = newMission();
  assert.equal(missionStep(m, { ...base, t: 0.5 }).length, 0);
  const first = missionStep(m, { ...base, t: 2 });
  assert.equal(first.length, 1);
  assert.equal(first[0].who, 'CAPCOM');
  assert.equal(missionStep(m, { ...base, t: 3 }).length, 0, 'no talking over each other');
  const second = missionStep(m, { ...base, t: 9.5 });
  assert.equal(second[0].who, 'NAV-AI');
});

test('nothing is transmitted while behind the Moon, and the line is not lost', () => {
  const m = newMission();
  const during = missionStep(m, { ...base, t: 100, stage: 'orbit', orbit: 0.45, linkLost: true });
  assert.equal(during.length, 0);
  const after = missionStep(m, { ...base, t: 106, stage: 'orbit', orbit: 0.45, linkLost: false });
  assert.equal(after.length > 0, true);
});

test('every scripted beat fires exactly once over a full mission', () => {
  const m = newMission();
  const seen: string[] = [];
  let t = 0;
  const run = (patch: Partial<MissionFacts>, seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) {
      t += 0.1;
      for (const l of missionStep(m, { ...base, ...patch, t })) seen.push(l.text);
    }
  };
  run({}, 20);
  run({ stage: 'burn', altKm: 900 }, 15);
  run({ stage: 'burn', altKm: 300 }, 15);
  run({ stage: 'orbit', altKm: 110, orbit: 0.3 }, 20);
  run({ stage: 'orbit', altKm: 110, orbit: 0.42, linkLost: true }, 20);
  run({ stage: 'orbit', altKm: 110, orbit: 0.7 }, 30);
  run({ stage: 'orbit', altKm: 110, orbit: 0.9 }, 15);
  run({ stage: 'done', altKm: 110, orbit: 1 }, 30);
  assert.equal(new Set(seen).size, seen.length, 'no line repeated');
  assert.match(seen.join('\n'), /Orbit achieved/);
  assert.match(seen.join('\n'), /Acquisition of signal/);
  assert.match(seen.join('\n'), /lights stay on/);
});

test('looking away from the Moon during the lap draws one warning, not a flood', () => {
  const m = newMission();
  m.sent = new Set(['brief1', 'brief2', 'lock', 'burn', 'orbit', 'o25', 'los', 'aos', 'aos2', 'o75', 'o80']);
  m.lastLineAt = 0;
  let nags = 0;
  for (let i = 0; i < 400; i++) {
    const t = 10 + i * 0.1;
    nags += missionStep(m, { ...base, t, stage: 'orbit', orbit: 0.3, facingDeg: 120 }).filter((l) => /left the window/.test(l.text)).length;
  }
  assert.equal(nags, 2); // t=10..50 s: one nag after 3 s, the next 25 s later
});
