// Coordinate math for the simulator. Two separate problems live here:
//
// 1. Selenographic lat/lon <-> a point on the three.js Moon mesh. The mesh
//    is a SphereGeometry textured with an equirectangular map whose centre
//    column is lon 0 and whose width spans -180..+180 (east positive).
//    SphereGeometry puts u=0.5 on +X and increasing u toward -Z, so
//    east longitude runs toward -Z. tests/coords.test.ts checks this
//    against real SphereGeometry vertices rather than trusting the algebra.
//
// 2. Equatorial (RA/Dec) -> horizon (alt/az) for an observer. That needs
//    sidereal time and the observer's latitude/longitude; it is NOT a
//    plain sphere mapping. Sidereal time comes from astronomy-engine.
import * as Astronomy from 'astronomy-engine';

export const MOON_RADIUS_KM = 1737.4;
const DEG = Math.PI / 180;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Selenographic latitude/longitude (degrees, east positive) -> point on a sphere of the given radius. */
export function latLonToVec3(latDeg: number, lonDeg: number, radius = 1): Vec3 {
  const phi = latDeg * DEG;
  const lam = lonDeg * DEG;
  return {
    x: radius * Math.cos(phi) * Math.cos(lam),
    y: radius * Math.sin(phi),
    z: -radius * Math.cos(phi) * Math.sin(lam),
  };
}

/** Inverse of latLonToVec3. Longitude is returned in (-180, 180]. */
export function vec3ToLatLon(v: Vec3): { latDeg: number; lonDeg: number } {
  const r = Math.hypot(v.x, v.y, v.z);
  return {
    latDeg: Math.asin(v.y / r) / DEG,
    lonDeg: Math.atan2(-v.z, v.x) / DEG,
  };
}

/** Equirectangular texture coordinates (u east-wards 0..1, v 0 at the south pole) for a lat/lon. */
export function latLonToUV(latDeg: number, lonDeg: number): { u: number; v: number } {
  return { u: (lonDeg + 180) / 360, v: (latDeg + 90) / 180 };
}

/** Great-circle separation between two lat/lon points, in degrees. */
export function angularDistanceDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dl = (lon2 - lon1) * DEG;
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return Math.acos(Math.min(1, Math.max(-1, c))) / DEG;
}

export function formatLat(latDeg: number): string {
  return `${Math.abs(latDeg).toFixed(2)}°${latDeg < 0 ? 'S' : 'N'}`;
}

export function formatLon(lonDeg: number): string {
  return `${Math.abs(lonDeg).toFixed(2)}°${lonDeg < 0 ? 'W' : 'E'}`;
}

export interface Observer {
  /** Degrees north. */
  latDeg: number;
  /** Degrees east of Greenwich (west negative). */
  lonDeg: number;
}

/** Local apparent sidereal time in hours [0, 24). */
export function localSiderealHours(utc: Date, lonDeg: number): number {
  const h = (Astronomy.SiderealTime(utc) + lonDeg / 15) % 24;
  return h < 0 ? h + 24 : h;
}

/**
 * RA/Dec (of date) -> altitude/azimuth for an observer.
 * Hour angle H = LST - RA; then the standard spherical transform. Azimuth is
 * measured from north through east. No atmospheric refraction applied.
 */
export function raDecToAltAz(
  raHours: number,
  decDeg: number,
  observer: Observer,
  utc: Date,
): { altDeg: number; azDeg: number } {
  const H = (localSiderealHours(utc, observer.lonDeg) - raHours) * 15 * DEG;
  const dec = decDeg * DEG;
  const lat = observer.latDeg * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));
  const az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
  const azDeg = (az / DEG + 360) % 360;
  return { altDeg: alt / DEG, azDeg };
}

/** Sun and Moon positions for an observer, from astronomy-engine's ephemeris. */
export function bodyHorizon(body: 'Sun' | 'Moon', observer: Observer, utc: Date) {
  const obs = new Astronomy.Observer(observer.latDeg, observer.lonDeg, 0);
  const eq = Astronomy.Equator(Astronomy.Body[body], utc, obs, true, true);
  const hor = Astronomy.Horizon(utc, obs, eq.ra, eq.dec, 'normal');
  return { raHours: eq.ra, decDeg: eq.dec, altDeg: hor.altitude, azDeg: hor.azimuth };
}

/**
 * Libration: selenographic coordinates of the sub-Earth point plus the
 * angular size and distance. Used to orient the Moon so the near side faces
 * the viewer the way it does from Earth right now.
 */
export function moonLibration(utc: Date) {
  const lib = Astronomy.Libration(utc);
  return { elonDeg: lib.elon, elatDeg: lib.elat, distKm: lib.dist_km };
}

/** Phase angle in degrees (0 = new, 180 = full) and illuminated fraction. */
export function moonPhase(utc: Date) {
  const angle = Astronomy.MoonPhase(utc);
  return { angleDeg: angle, illuminated: (1 - Math.cos(angle * DEG)) / 2 };
}
