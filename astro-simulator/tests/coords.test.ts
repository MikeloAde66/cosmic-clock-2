import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import {
  angularDistanceDeg,
  latLonToUV,
  latLonToVec3,
  raDecToAltAz,
  vec3ToLatLon,
  localSiderealHours,
} from '../lib/astro/coords.ts';

test('lat/lon round trips through the vector mapping', () => {
  for (const [lat, lon] of [[0, 0], [43.3, -11.2], [-80, 170], [12, -179], [89, 45]]) {
    const back = vec3ToLatLon(latLonToVec3(lat, lon));
    assert.ok(Math.abs(back.latDeg - lat) < 1e-9);
    assert.ok(Math.abs(back.lonDeg - lon) < 1e-9);
  }
});

test('lat/lon agrees with real SphereGeometry vertices and UVs', () => {
  const geo = new THREE.SphereGeometry(1, 128, 64);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  let checked = 0;
  for (let i = 0; i < pos.count; i += 37) {
    const v = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
    const ll = vec3ToLatLon(v);
    const expect = latLonToUV(ll.latDeg, ll.lonDeg);
    // Skip the seam / poles where u is ambiguous.
    if (Math.abs(ll.latDeg) > 89 || Math.abs(Math.abs(ll.lonDeg) - 180) < 1) continue;
    assert.ok(Math.abs(uv.getX(i) - expect.u) < 1e-6, `u mismatch at vertex ${i}`);
    assert.ok(Math.abs(uv.getY(i) - expect.v) < 1e-6, `v mismatch at vertex ${i}`);
    checked++;
  }
  assert.ok(checked > 50);
});

test('lon 0 lat 0 is +X; east longitude runs toward -Z', () => {
  const o = latLonToVec3(0, 0);
  assert.ok(Math.abs(o.x - 1) < 1e-12);
  assert.ok(latLonToVec3(0, 90).z < -0.99);
  assert.ok(latLonToVec3(90, 0).y > 0.99);
});

test('angular distance', () => {
  assert.ok(Math.abs(angularDistanceDeg(0, 0, 0, 90) - 90) < 1e-9);
  assert.ok(Math.abs(angularDistanceDeg(10, 20, 10, 20)) < 1e-6);
});

test('RA/Dec -> alt/az honours sidereal time and observer location', () => {
  const t = new Date('2026-03-20T12:00:00Z');
  const obs = { latDeg: 32.78, lonDeg: -79.93 };
  const lst = localSiderealHours(t, obs.lonDeg);
  // A star on the local meridian (RA = LST) at the observer's latitude is at the zenith.
  const zen = raDecToAltAz(lst, obs.latDeg, obs, t);
  assert.ok(Math.abs(zen.altDeg - 90) < 1e-6);
  // Same star, six hours later in RA, is on the horizon (|H| = 90deg, dec = lat -> alt ~ 0 only at dec=0; use dec=0).
  const west = raDecToAltAz((lst - 6 + 24) % 24, 0, { latDeg: 0, lonDeg: obs.lonDeg }, t);
  assert.ok(Math.abs(west.altDeg) < 1e-6);
  // Cross-check against astronomy-engine's own Horizon for the Sun.
  const o = new Astronomy.Observer(obs.latDeg, obs.lonDeg, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, t, o, true, true);
  const ref = Astronomy.Horizon(t, o, eq.ra, eq.dec);
  const mine = raDecToAltAz(eq.ra, eq.dec, obs, t);
  assert.ok(Math.abs(mine.altDeg - ref.altitude) < 0.05, `alt ${mine.altDeg} vs ${ref.altitude}`);
  assert.ok(Math.abs(mine.azDeg - ref.azimuth) < 0.05, `az ${mine.azDeg} vs ${ref.azimuth}`);
});
