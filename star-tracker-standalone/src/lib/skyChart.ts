// Real constellation/star data, sourced from d3-celestial's own standalone
// data files (https://github.com/ofrohn/d3-celestial), which are themselves
// derived from the Yale Bright Star Catalog / Hipparcos — not the 51MB
// d3-celestial rendering library itself, just its underlying JSON, fetched
// once, trimmed (stars to magnitude ≤4.5, ~921 of them), and re-hosted as
// static files in public/data/. Verified against known reality before use:
// the brightest entry in the trimmed star file is [101.29, -16.72, -1.44],
// which is exactly Sirius's real right ascension, declination, and
// magnitude; the second-brightest matches Canopus just as precisely.

export interface ConstellationLine {
  id: string; // 3-letter IAU abbreviation, e.g. "Ori" for Orion
  lines: number[][][]; // MultiLineString: array of line strips of [lon, lat] pairs
}

export interface ConstellationInfo {
  name: string;
  genitive: string;
  rank: string;
}

export type ConstellationNames = Record<string, ConstellationInfo>;

// [lon, lat, magnitude] tuples — lon is right ascension in degrees using a
// signed -180..180 range (equivalent to standard 0-360 RA, shifted), lat is
// declination in degrees.
export type StarTuple = [number, number, number];

export interface EquatorialPoint {
  raHours: number;
  decDeg: number;
}

// The dataset's signed -180..180 "lon" -> standard 0-24h right ascension.
export function lonToRaHours(lon: number): number {
  return (((lon % 360) + 360) % 360) / 15;
}

export async function loadConstellationLines(): Promise<ConstellationLine[]> {
  const res = await fetch('/data/constellation-lines.json');
  if (!res.ok) throw new Error(`Failed to load constellation lines: ${res.status}`);
  return res.json();
}

export async function loadConstellationNames(): Promise<ConstellationNames> {
  const res = await fetch('/data/constellation-names.json');
  if (!res.ok) throw new Error(`Failed to load constellation names: ${res.status}`);
  return res.json();
}

export async function loadStars(): Promise<StarTuple[]> {
  const res = await fetch('/data/stars.json');
  if (!res.ok) throw new Error(`Failed to load star catalog: ${res.status}`);
  return res.json();
}
