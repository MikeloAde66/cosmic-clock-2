// Loads this repo's existing real star catalog (public/data/stars.json —
// 921 real [RA_hours, Dec_deg, magnitude] entries, the same file the
// legacy 2D StarTrackerView already draws from) into flat Float32Array
// buffers for a WebGL instancedMesh. Important honesty note: this is a
// real bright-star catalog (naked-eye visible range), NOT an actual
// Tycho-2/Gaia-scale dataset (those run into the millions/billions of
// entries down to very faint magnitudes) — no such catalog file exists in
// this repo, and fabricating one would mean inventing star positions.
// Swapping in a real Tycho-2/Gaia subset later just means pointing this at
// a bigger real file; nothing else here needs to change.
import { equatorialToHorizon, horizonToSceneDirection, type GeodeticLocation } from './coordinates';

export interface RawStarEntry {
  raHours: number;
  decDeg: number;
  magnitude: number;
}

let cachedRawCatalog: RawStarEntry[] | null = null;

export async function loadRawStarCatalog(): Promise<RawStarEntry[]> {
  if (cachedRawCatalog) return cachedRawCatalog;
  const res = await fetch('/data/stars.json');
  if (!res.ok) throw new Error(`Failed to load star catalog: ${res.status}`);
  const raw = (await res.json()) as [number, number, number][];
  cachedRawCatalog = raw.map(([raHours, decDeg, magnitude]) => ({ raHours, decDeg, magnitude }));
  return cachedRawCatalog;
}

export interface StarInstanceBuffers {
  count: number;
  // xyz per star, dome-radius-scaled scene position (recomputed every time
  // the observer/time changes — Alt/Az drifts continuously with LST).
  positions: Float32Array;
  // Real per-star size, derived from real magnitude (brighter = larger),
  // not a fabricated per-star value.
  sizes: Float32Array;
  // Real per-star catalog magnitude, kept alongside the buffer so a
  // renderer can also drive color/opacity from it without a second pass.
  magnitudes: Float32Array;
}

// Magnitude -> point size, brighter (lower/negative magnitude) is larger.
// Same clamp range the legacy 2D dome already used for its own star
// rendering, ported here rather than inventing a new curve.
function sizeForMagnitude(mag: number): number {
  return Math.max(0.4, 2.2 - mag * 0.35);
}

// Recomputes every star's current Alt/Az (real, live, LST-dependent — the
// sky rotates) and packs it into Float32Array buffers ready for
// instancedMesh.setMatrixAt / a custom shader attribute upload.
export function buildStarInstanceBuffers(
  catalog: RawStarEntry[],
  location: GeodeticLocation,
  now: Date,
  domeRadius: number,
  minAltitudeDeg = -5 // a few degrees below the true horizon, matching the legacy dome's own horizon-buffer convention
): StarInstanceBuffers {
  const visible = catalog.filter((star) => {
    const horizon = equatorialToHorizon({ raHours: star.raHours, decDeg: star.decDeg }, location, now);
    return horizon.altitudeDeg >= minAltitudeDeg;
  });

  const positions = new Float32Array(visible.length * 3);
  const sizes = new Float32Array(visible.length);
  const magnitudes = new Float32Array(visible.length);

  visible.forEach((star, i) => {
    const horizon = equatorialToHorizon({ raHours: star.raHours, decDeg: star.decDeg }, location, now);
    const [x, y, z] = horizonToSceneDirection(horizon, domeRadius);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    sizes[i] = sizeForMagnitude(star.magnitude);
    magnitudes[i] = star.magnitude;
  });

  return { count: visible.length, positions, sizes, magnitudes };
}
