// Baseline regression test for lib/astronomy/ephemeris.ts — Charleston,
// SC (32.82N, 80.00W), M31, Sept 11/12 2026. Run with:
//   node --test tests/ephemeris.test.ts
//
// Tolerances are set around real computed values (verified against
// astronomy-engine's sidereal time), not forced to match a hypothetical
// example payload's rounded numbers exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  raToHours,
  decToDegrees,
  localSiderealTimeHours,
  computeHorizontalPosition,
  findAltitudeCrossingUtc,
  type EquatorialCoords,
  type ObserverLocation,
} from '../lib/astronomy/ephemeris.ts';

const CHARLESTON: ObserverLocation = { latDeg: 32.82, lonDeg: -80.0, elevationM: 3 };

// M31 (Andromeda Galaxy), J2000 catalog position.
const M31_RA_H = raToHours(0, 42, 44);
const M31_DEC_DEG = decToDegrees(41, 16, 9);
const M31: EquatorialCoords = { raHours: M31_RA_H, decDeg: M31_DEC_DEG };

test('sexagesimal conversion matches M31 catalog coordinates', () => {
  assert.ok(Math.abs(M31_RA_H - 0.712222) < 1e-4, `RA hours was ${M31_RA_H}`);
  assert.ok(Math.abs(M31_DEC_DEG - 41.269167) < 1e-4, `Dec degrees was ${M31_DEC_DEG}`);
});

test('LST for Charleston is ~19.06h at 9 PM EDT on Sept 11, 2026', () => {
  // 9 PM EDT Sept 11 == 01:00 UTC Sept 12 (EDT is UTC-4).
  const utc = new Date('2026-09-12T01:00:00Z');
  const lst = localSiderealTimeHours(utc, CHARLESTON.lonDeg);
  assert.ok(Math.abs(lst - 19.06) < 0.05, `LST was ${lst.toFixed(4)}h, expected ~19.06h`);
});

test('M31 altitude/azimuth at 9 PM EDT is a low-but-rising position in the east', () => {
  const utc = new Date('2026-09-12T01:00:00Z');
  const pos = computeHorizontalPosition(M31, CHARLESTON, utc);
  assert.ok(pos.altitudeDeg > 15 && pos.altitudeDeg < 35, `altitude was ${pos.altitudeDeg.toFixed(2)}`);
  assert.ok(pos.azimuthDeg > 40 && pos.azimuthDeg < 90, `azimuth was ${pos.azimuthDeg.toFixed(2)}`);
});

test('M31 crosses 45deg altitude at ~10:54 PM EDT (02:54 UTC) on Sept 11/12, 2026', () => {
  const start = new Date('2026-09-12T01:00:00Z');
  const end = new Date('2026-09-12T05:00:00Z');
  const crossing = findAltitudeCrossingUtc(M31, CHARLESTON, start, end, 45.0);

  assert.ok(crossing, 'expected a 45deg crossing within the search window');
  const expected = new Date('2026-09-12T02:54:00Z').getTime();
  const diffMinutes = Math.abs((crossing!.getTime() - expected) / 60_000);
  assert.ok(diffMinutes <= 5, `crossing was ${crossing!.toISOString()}, expected within 5 min of 02:54 UTC`);
});
