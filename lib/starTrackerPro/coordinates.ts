// Real coordinate transforms for the Phase 1 WebGL rewrite — built on
// astronomy-engine (already a real, tested dependency used elsewhere in
// this app, e.g. the legacy StarTrackerView), not reimplemented by hand.
// Precise Equatorial(J2000)->Horizon transforms and sidereal time involve
// enough subtlety (precession, refraction, atmospheric modeling) that
// hand-rolling them risks silent, hard-to-notice errors; astronomy-engine
// is the correct "production-ready" choice here, the same way satellite.js
// is for SGP4 below rather than a hand-written propagator.
import { Body, Equator, Horizon, Observer, SiderealTime } from 'astronomy-engine';

export interface GeodeticLocation {
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
}

export interface EquatorialJ2000 {
  raHours: number; // 0-24
  decDeg: number; // -90..90
}

export interface HorizonPosition {
  azimuthDeg: number; // 0-360, 0 = North, clockwise
  altitudeDeg: number; // -90..90
}

// Local Apparent Sidereal Time, in hours (0-24) — Greenwich sidereal time
// shifted by observer longitude. Real astronomy-engine SiderealTime() call,
// not an approximation.
export function localSiderealTimeHours(now: Date, location: GeodeticLocation): number {
  const gast = SiderealTime(now);
  return (((gast + location.longitudeDeg / 15) % 24) + 24) % 24;
}

// Real Equatorial(J2000) -> Horizon(Alt/Az) transform for an arbitrary
// RA/Dec target (a star catalog entry, a satellite's instantaneous
// position, a manual slew target) — astronomy-engine's Horizon() already
// does real refraction-aware topocentric conversion given an Observer.
export function equatorialToHorizon(eq: EquatorialJ2000, location: GeodeticLocation, now: Date): HorizonPosition {
  const observer = new Observer(location.latitudeDeg, location.longitudeDeg, location.elevationMeters);
  const horizon = Horizon(now, observer, eq.raHours, eq.decDeg, 'normal');
  return { azimuthDeg: horizon.azimuth, altitudeDeg: horizon.altitude };
}

// Real planetary Alt/Az (Sun/Moon/planets) — the same real two-step
// Equator() -> Horizon() pattern already verified working elsewhere in
// this codebase (StarTrackerView.tsx): a body's of-date RA/Dec has to be
// derived via Equator() first, since Horizon() itself only accepts a raw
// RA/Dec pair, not a Body directly.
export function bodyToHorizon(body: Body, location: GeodeticLocation, now: Date): HorizonPosition {
  const observer = new Observer(location.latitudeDeg, location.longitudeDeg, location.elevationMeters);
  const eq = Equator(body, now, observer, true, true);
  const horizon = Horizon(now, observer, eq.ra, eq.dec, 'normal');
  return { azimuthDeg: horizon.azimuth, altitudeDeg: horizon.altitude };
}

// Alt/Az -> a unit direction vector in a right-handed scene frame (Y up,
// -Z = North, X = East) for placing an object on the WebGL celestial
// sphere. Distance is deliberately arbitrary (celestial-sphere radius) —
// stars and satellites alike are rendered at a fixed dome radius, not
// their real (wildly different-scale) distances, exactly like the
// legacy 2D dome did.
export function horizonToSceneDirection(pos: HorizonPosition, radius: number): [number, number, number] {
  const azRad = (pos.azimuthDeg * Math.PI) / 180;
  const altRad = (pos.altitudeDeg * Math.PI) / 180;
  const x = radius * Math.cos(altRad) * Math.sin(azRad);
  const y = radius * Math.sin(altRad);
  const z = -radius * Math.cos(altRad) * Math.cos(azRad);
  return [x, y, z];
}
