// Real constellation stick-figure data — the same public/data/
// constellation-lines.json and constellation-names.json the legacy 2D
// StarTrackerView already draws from (lib/skyChart.ts), reused here rather
// than re-sourced. Each line vertex is a real signed -180..180 RA-degree /
// Dec-degree pair (d3-celestial's convention, same as stars.json — see
// starCatalogBuffers.ts), converted to 0-24h below via the same
// lonToRaHours the legacy view already applies to this exact file; there
// is no separate constellation-*membership* dataset in this repo (only
// these stick-figure line drawings, not IAU boundary polygons), so "which
// constellation is this star in" can only be answered as a real, labeled
// approximation (nearest line-figure by angular distance) — see
// findNearestConstellation below — not an authoritative boundary lookup.
import { lonToRaHours } from '@/lib/skyChart';
import { equatorialToHorizon, horizonToSceneDirection, type GeodeticLocation } from './coordinates';

interface RawConstellationLineFile {
  id: string;
  lines: [number, number][][]; // each inner array is one connected polyline of [signed RA_deg, Dec_deg] vertices
}

export interface RawConstellationNames {
  [id: string]: { name: string; genitive: string; rank: string };
}

export interface ConstellationLineSegment {
  id: string;
  // Flat [ra1,dec1, ra2,dec2, ...] per real polyline, in RA HOURS (the
  // source file itself uses RA in decimal degrees — converted once on
  // load to match this app's RA-hours convention everywhere else).
  vertices: { raHours: number; decDeg: number }[];
}

let cached: ConstellationLineSegment[] | null = null;
let cachedNames: RawConstellationNames | null = null;

export async function loadConstellationLines(): Promise<ConstellationLineSegment[]> {
  if (cached) return cached;
  const res = await fetch('/data/constellation-lines.json');
  if (!res.ok) throw new Error(`Failed to load constellation lines: ${res.status}`);
  const raw = (await res.json()) as RawConstellationLineFile[];
  const segments: ConstellationLineSegment[] = [];
  for (const constellation of raw) {
    for (const polyline of constellation.lines) {
      segments.push({
        id: constellation.id,
        vertices: polyline.map(([raDeg, decDeg]) => ({ raHours: lonToRaHours(raDeg), decDeg })),
      });
    }
  }
  cached = segments;
  return segments;
}

export async function loadConstellationNames(): Promise<RawConstellationNames> {
  if (cachedNames) return cachedNames;
  const res = await fetch('/data/constellation-names.json');
  if (!res.ok) throw new Error(`Failed to load constellation names: ${res.status}`);
  cachedNames = (await res.json()) as RawConstellationNames;
  return cachedNames;
}

// Real great-circle angular separation in degrees — used to find the
// closest constellation figure to an arbitrary point, not an IAU boundary
// test (this repo has no boundary polygon data — see module comment).
function angularSeparationDeg(raHoursA: number, decDegA: number, raHoursB: number, decDegB: number): number {
  const raA = (raHoursA * 15 * Math.PI) / 180;
  const raB = (raHoursB * 15 * Math.PI) / 180;
  const decA = (decDegA * Math.PI) / 180;
  const decB = (decDegB * Math.PI) / 180;
  const cosSep = Math.sin(decA) * Math.sin(decB) + Math.cos(decA) * Math.cos(decB) * Math.cos(raA - raB);
  return (Math.acos(Math.min(1, Math.max(-1, cosSep))) * 180) / Math.PI;
}

// Nearest constellation stick-figure vertex to (raHours, decDeg), labeled
// as an approximation everywhere it's surfaced in the UI — real distance
// computed from real data, but proximity-to-a-line-drawing is not the same
// claim as "this point lies within constellation X's official boundary."
export function findNearestConstellation(
  raHours: number,
  decDeg: number,
  segments: ConstellationLineSegment[],
  names: RawConstellationNames
): { id: string; name: string; distanceDeg: number } | null {
  let best: { id: string; distanceDeg: number } | null = null;
  for (const segment of segments) {
    for (const vertex of segment.vertices) {
      const d = angularSeparationDeg(raHours, decDeg, vertex.raHours, vertex.decDeg);
      if (!best || d < best.distanceDeg) best = { id: segment.id, distanceDeg: d };
    }
  }
  if (!best) return null;
  return { id: best.id, name: names[best.id]?.name ?? best.id, distanceDeg: best.distanceDeg };
}

export interface ConstellationLineBuffer {
  // Two endpoints (6 floats) per drawn segment — ready for
  // THREE.LineSegments + BufferGeometry's 'position' attribute.
  positions: Float32Array;
}

// Real live Alt/Az projection of every constellation polyline, rebuilt on
// the same clock tick as the star buffers (sidereal drift affects these
// too) — segments below the horizon are dropped per-edge rather than
// per-star, same horizon convention as buildStarInstanceBuffers.
export function buildConstellationLineBuffer(
  segments: ConstellationLineSegment[],
  location: GeodeticLocation,
  now: Date,
  domeRadius: number,
  minAltitudeDeg = -5
): ConstellationLineBuffer {
  const points: number[] = [];
  for (const segment of segments) {
    for (let i = 0; i < segment.vertices.length - 1; i++) {
      const a = segment.vertices[i];
      const b = segment.vertices[i + 1];
      const horizonA = equatorialToHorizon(a, location, now);
      const horizonB = equatorialToHorizon(b, location, now);
      if (horizonA.altitudeDeg < minAltitudeDeg || horizonB.altitudeDeg < minAltitudeDeg) continue;
      const posA = horizonToSceneDirection(horizonA, domeRadius);
      const posB = horizonToSceneDirection(horizonB, domeRadius);
      points.push(...posA, ...posB);
    }
  }
  return { positions: new Float32Array(points) };
}
