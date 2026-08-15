// Simplified room-lumens estimator for the "BETA DEMO ONLY" Q-Flow tool in
// Pods. Not a professional lighting-design calculation (those need real
// per-fixture coefficient-of-utilization and light-loss-factor data this
// app doesn't have) — this uses the standard illuminance relationship
// (lumens = area x target footcandles) with two physically-motivated
// adjustments: a fixed loss-factor multiplier standing in for typical
// room/fixture inefficiency, and a ceiling-height correction (light has to
// travel further to reach the same measured footcandles at the work
// plane, so required output scales with the square of height relative to
// a 10ft reference ceiling).
export interface LumensPlanInput {
  length: number; // feet
  width: number; // feet
  footcandles: number; // target illuminance at the work plane
  ceilingHeight?: number; // feet, defaults to a 10ft reference
}

export interface LumensPlan {
  totalLumens: number;
  bulbCount: number;
  wattsTotal: number;
  placement: string[];
}

const REFERENCE_CEILING_HEIGHT_FT = 10;
const LOSS_FACTOR = 2; // stand-in for combined coefficient-of-utilization + light-loss-factor
const LUMENS_PER_BULB = 800; // ~60W-incandescent-equivalent modern LED
const WATTS_PER_BULB = 9;

export function calculateLumensPlan({
  length,
  width,
  footcandles,
  ceilingHeight = REFERENCE_CEILING_HEIGHT_FT,
}: LumensPlanInput): LumensPlan {
  const area = Math.max(0, length) * Math.max(0, width);
  const heightFactor = (Math.max(1, ceilingHeight) / REFERENCE_CEILING_HEIGHT_FT) ** 2;
  const totalLumens = Math.round(area * Math.max(0, footcandles) * LOSS_FACTOR * heightFactor);

  const bulbCount = totalLumens > 0 ? Math.max(1, Math.ceil(totalLumens / LUMENS_PER_BULB)) : 0;
  const wattsTotal = bulbCount * WATTS_PER_BULB;

  const placement: string[] = [];
  if (bulbCount > 0 && length > 0 && width > 0) {
    const aspect = length / width;
    const cols = Math.max(1, Math.round(Math.sqrt(bulbCount * aspect)));
    const rows = Math.max(1, Math.ceil(bulbCount / cols));
    placement.push(`${rows}x${cols} evenly spaced grid`);
    placement.push(`~${(length / cols).toFixed(1)}ft between columns`);
    placement.push(`~${(width / rows).toFixed(1)}ft between rows`);
  }

  return { totalLumens, bulbCount, wattsTotal, placement };
}
