import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, deployChute, newProbe, pressureBar, stepProbe } from '../lib/probe/model.ts';

test('Venus profile lands near the known surface and 50 km figures', () => {
  const v = PLANETS.venus;
  assert.ok(Math.abs(pressureBar(v, 0) - 92) < 4);
  assert.equal(Math.round(v.temp(0)), 737);
  const p50 = pressureBar(v, 50);
  assert.ok(p50 > 0.8 && p50 < 1.4, `p50=${p50}`);
});

test('Jupiter profile is ~1 bar at the reference level and ~22 bar near 130 km below', () => {
  const j = PLANETS.jupiter;
  assert.ok(Math.abs(pressureBar(j, 0) - 1) < 0.1);
  const p = pressureBar(j, -132);
  assert.ok(p > 18 && p < 28, `p=${p}`);
});

test('keeping the chute gives a gentler Venus touchdown than dropping bare', () => {
  const v = PLANETS.venus;
  const ok = newProbe(v);
  deployChute(ok, v);
  for (let i = 0; i < 200000 && ok.status === 'descending'; i++) stepProbe(ok, v, 1);
  assert.equal(ok.status, 'landed');

  const bad = newProbe(v);
  for (let i = 0; i < 200000 && bad.status === 'descending'; i++) stepProbe(bad, v, 1);
  assert.ok(bad.integrity < ok.integrity, `bare ${bad.integrity} vs chute ${ok.integrity}`);
});
