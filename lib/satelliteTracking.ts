// Real-time-only satellite tracking — converts a satellite's current
// geographic position (lat/lon/altitude) into the observer's local
// altitude/azimuth via standard ECEF -> observer-local ENU geodesy math.
// This answers "is it visible right now, and where," not "when will it next
// pass over" — that needs real orbital propagation (SGP4) from TLE data,
// a substantially bigger undertaking left out of this pass on purpose.

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;

export interface GeoPosition {
  latitude: number; // degrees
  longitude: number; // degrees
  altitude: number; // km above the surface
}

export interface TopocentricPosition {
  azimuth: number; // degrees, 0 = north, 90 = east
  altitude: number; // degrees above the horizon
  rangeKm: number;
}

function toECEF(lat: number, lon: number, altKm: number): [number, number, number] {
  const r = EARTH_RADIUS_KM + altKm;
  const latR = lat * DEG;
  const lonR = lon * DEG;
  return [r * Math.cos(latR) * Math.cos(lonR), r * Math.cos(latR) * Math.sin(lonR), r * Math.sin(latR)];
}

function dot(a: number[], b: number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Standard ECEF -> ENU -> az/alt conversion, the same geometry real
// satellite-tracking software uses for the observer-relative step — just
// against a spherical Earth rather than the WGS84 ellipsoid, which is well
// within the accuracy this feature needs.
export function topocentricPosition(observer: GeoPosition, target: GeoPosition): TopocentricPosition {
  const obsVec = toECEF(observer.latitude, observer.longitude, observer.altitude);
  const tgtVec = toECEF(target.latitude, target.longitude, target.altitude);
  const d = [tgtVec[0] - obsVec[0], tgtVec[1] - obsVec[1], tgtVec[2] - obsVec[2]];

  const latR = observer.latitude * DEG;
  const lonR = observer.longitude * DEG;
  const east = [-Math.sin(lonR), Math.cos(lonR), 0];
  const north = [-Math.sin(latR) * Math.cos(lonR), -Math.sin(latR) * Math.sin(lonR), Math.cos(latR)];
  const up = [Math.cos(latR) * Math.cos(lonR), Math.cos(latR) * Math.sin(lonR), Math.sin(latR)];

  const e = dot(d, east);
  const n = dot(d, north);
  const u = dot(d, up);

  return {
    rangeKm: Math.sqrt(e * e + n * n + u * u),
    azimuth: (Math.atan2(e, n) / DEG + 360) % 360,
    altitude: Math.atan2(u, Math.sqrt(e * e + n * n)) / DEG,
  };
}

export interface IssStatus {
  geo: GeoPosition;
  visibility: string; // "daylight" | "eclipsed" | "visible", as reported by the API
}

// api.wheretheiss.at — free, no API key, real-time position only.
export async function fetchIssPosition(): Promise<IssStatus> {
  const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
  if (!res.ok) throw new Error(`ISS position fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    geo: { latitude: data.latitude, longitude: data.longitude, altitude: data.altitude },
    visibility: data.visibility,
  };
}
