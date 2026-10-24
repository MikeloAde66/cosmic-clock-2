import raw from '@/data/lunar-targets.json';
import { angularDistanceDeg, MOON_RADIUS_KM } from '@/lib/astro/coords';

export interface LunarTarget {
  name: string;
  type: string;
  latDeg: number;
  lonDeg: number;
  diameterKm: number | null;
  depthKm: number | null;
  status: 'UNVERIFIED' | 'VERIFIED';
}

export const LUNAR_TARGETS = raw.targets as LunarTarget[];

/** Angular radius the reticle must fall within to lock: the feature's own size, but never smaller than MIN_LOCK_DEG. */
const MIN_LOCK_DEG = 1.5;
const MAX_LOCK_DEG = 12;

export function lockRadiusDeg(t: LunarTarget): number {
  if (t.diameterKm == null) return MIN_LOCK_DEG;
  const featureDeg = (t.diameterKm / 2 / MOON_RADIUS_KM) * (180 / Math.PI);
  return Math.min(MAX_LOCK_DEG, Math.max(MIN_LOCK_DEG, featureDeg));
}

/** The named feature the reticle is inside, nearest centre first, or null. */
export function findLockedTarget(latDeg: number, lonDeg: number): LunarTarget | null {
  let best: LunarTarget | null = null;
  let bestScore = Infinity;
  for (const t of LUNAR_TARGETS) {
    const d = angularDistanceDeg(latDeg, lonDeg, t.latDeg, t.lonDeg);
    const r = lockRadiusDeg(t);
    // Score by fraction of the feature radius so a small crater inside a big mare still wins.
    if (d <= r && d / r < bestScore) {
      best = t;
      bestScore = d / r;
    }
  }
  return best;
}
