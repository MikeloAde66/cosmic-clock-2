// Deterministic ephemeris math: Local Sidereal Time, Hour Angle, and
// equatorial (RA/Dec) -> horizontal (Alt/Az) conversion. No network calls,
// no Kali tool loop — this is the pure-math layer other things sit on top
// of later, per the "Keep Ephemeris Pure" requirement.
//
// Sidereal time comes from astronomy-engine (already a real dependency
// here), which implements the actual Meeus-based GAST algorithm — safer
// and more accurate than re-deriving the GMST polynomial by hand. The
// Hour Angle -> Alt/Az transform below is the standard spherical-astronomy
// formula (Duffett-Smith / Meeus), implemented directly since it's simple
// and needs to be transparent for the crossing-time search.
import * as Astronomy from 'astronomy-engine';

export interface EquatorialCoords {
  /** Right ascension, decimal hours. */
  raHours: number;
  /** Declination, decimal degrees (positive north). */
  decDeg: number;
}

export interface ObserverLocation {
  /** Degrees north of the equator (negative for south). */
  latDeg: number;
  /** Degrees east of Greenwich (negative for west — e.g. Charleston is -80.00). */
  lonDeg: number;
  elevationM?: number;
}

export interface HorizontalPosition {
  altitudeDeg: number;
  /** Measured from North through East, [0, 360). */
  azimuthDeg: number;
}

export interface AltitudeSample extends HorizontalPosition {
  timeUtc: Date;
}

function normalizeHours(hours: number): number {
  const h = hours % 24;
  return h < 0 ? h + 24 : h;
}

function normalizeDegrees(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** Converts sexagesimal RA (h, m, s) to decimal hours. */
export function raToHours(h: number, m: number, s: number): number {
  const sign = h < 0 ? -1 : 1;
  return sign * (Math.abs(h) + m / 60 + s / 3600);
}

/** Converts sexagesimal Dec (d, m, s) to decimal degrees. */
export function decToDegrees(d: number, m: number, s: number): number {
  const sign = d < 0 ? -1 : 1;
  return sign * (Math.abs(d) + m / 60 + s / 3600);
}

/** Greenwich Apparent Sidereal Time, in hours [0, 24). */
export function greenwichSiderealTimeHours(utc: Date): number {
  return normalizeHours(Astronomy.SiderealTime(utc));
}

/**
 * Local Sidereal Time at a given longitude (degrees east of Greenwich,
 * negative for west), in hours [0, 24). This is what makes LST drift with
 * longitude rather than just tracking Greenwich time.
 */
export function localSiderealTimeHours(utc: Date, lonDeg: number): number {
  return normalizeHours(greenwichSiderealTimeHours(utc) + lonDeg / 15);
}

/**
 * Hour Angle in degrees: H = LST - RA, normalized to (-180, 180].
 * Positive means the target has passed the local meridian (west of it).
 */
export function hourAngleDeg(lstHours: number, raHours: number): number {
  const h = (lstHours - raHours) * 15;
  return (((h + 180) % 360) + 360) % 360 - 180;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * Standard equatorial -> horizontal transform. Azimuth is measured from
 * North through East, in degrees [0, 360).
 */
export function equatorialToHorizontal(
  latDeg: number,
  decDeg: number,
  hourAngleDegrees: number
): HorizontalPosition {
  const lat = latDeg * DEG;
  const dec = decDeg * DEG;
  const H = hourAngleDegrees * DEG;

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD;
  if (Math.sin(H) > 0) az = 360 - az;

  return { altitudeDeg: alt * RAD, azimuthDeg: normalizeDegrees(az) };
}

/** Full LST -> Hour Angle -> Alt/Az pipeline for one instant. */
export function computeHorizontalPosition(
  target: EquatorialCoords,
  observer: ObserverLocation,
  utc: Date
): HorizontalPosition & { lstHours: number; hourAngleDeg: number } {
  const lstHours = localSiderealTimeHours(utc, observer.lonDeg);
  const H = hourAngleDeg(lstHours, target.raHours);
  const horizontal = equatorialToHorizontal(observer.latDeg, target.decDeg, H);
  return { ...horizontal, lstHours, hourAngleDeg: H };
}

/** Samples Alt/Az at a fixed step across [startUtc, endUtc]. */
export function sampleAltitudeSeries(
  target: EquatorialCoords,
  observer: ObserverLocation,
  startUtc: Date,
  endUtc: Date,
  stepMinutes = 15
): AltitudeSample[] {
  const samples: AltitudeSample[] = [];
  const stepMs = stepMinutes * 60_000;
  for (let t = startUtc.getTime(); t <= endUtc.getTime(); t += stepMs) {
    const timeUtc = new Date(t);
    const { altitudeDeg, azimuthDeg } = computeHorizontalPosition(target, observer, timeUtc);
    samples.push({ timeUtc, altitudeDeg, azimuthDeg });
  }
  return samples;
}

/**
 * Finds the UTC instant within [startUtc, endUtc] where altitude first
 * crosses `targetAltitudeDeg`, via bisection. Requires the window to
 * contain exactly one crossing (altitude - target changes sign once);
 * returns null if the endpoints don't bracket a crossing.
 */
export function findAltitudeCrossingUtc(
  target: EquatorialCoords,
  observer: ObserverLocation,
  startUtc: Date,
  endUtc: Date,
  targetAltitudeDeg: number,
  toleranceSeconds = 1
): Date | null {
  const altitudeAt = (t: number) =>
    computeHorizontalPosition(target, observer, new Date(t)).altitudeDeg;

  let lo = startUtc.getTime();
  let hi = endUtc.getTime();
  const diffLo = altitudeAt(lo) - targetAltitudeDeg;
  const diffHi = altitudeAt(hi) - targetAltitudeDeg;

  if (diffLo === 0) return new Date(lo);
  if (diffLo * diffHi > 0) return null; // no sign change => no crossing in range

  while (hi - lo > toleranceSeconds * 1000) {
    const mid = (lo + hi) / 2;
    const diffMid = altitudeAt(mid) - targetAltitudeDeg;
    if (diffMid * diffLo <= 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return new Date(Math.round((lo + hi) / 2));
}
