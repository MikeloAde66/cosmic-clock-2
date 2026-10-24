import type { Snap } from './gcs';
import type { Mem, Objective } from './curriculum';

// Live instructor callouts, worked out from the simulator's telemetry ten
// times a second. Plain rules, no AI service: the active objective's
// grades say what "on the numbers" means, and each grade knows how to word
// its correction as a stick input. Safety calls (sink rate near the
// ground) and over-control outrank precision corrections.

export interface Callout {
  key: string;
  text: string;
  tone: 'warn' | 'fix' | 'good';
}

// Sign reversals of the right stick within this window count as over-control.
const REVERSAL_WINDOW = 3;
const REVERSAL_LIMIT = 6;

export interface StickHistory {
  sign: { pitch: number; roll: number };
  reversals: number[];
}

export function newStickHistory(): StickHistory {
  return { sign: { pitch: 0, roll: 0 }, reversals: [] };
}

/** Track right-stick direction changes; returns reversals in the last few seconds. */
export function trackReversals(h: StickHistory, s: Snap, t: number) {
  for (const axis of ['pitch', 'roll'] as const) {
    const v = s.input[axis];
    const sign = Math.abs(v) < 0.15 ? 0 : Math.sign(v);
    if (sign !== 0) {
      if (h.sign[axis] !== 0 && sign !== h.sign[axis]) h.reversals.push(t);
      h.sign[axis] = sign;
    }
  }
  h.reversals = h.reversals.filter((r) => t - r <= REVERSAL_WINDOW);
  return h.reversals.length;
}

export function instructorCall(s: Snap, m: Mem, o: Objective | undefined, reversals: number): Callout | null {
  if (!s.armed || s.landed || s.crashed) return null;

  if (s.alt < 6 && s.vz < -1.8) {
    return {
      key: 'sink',
      tone: 'warn',
      text: `Sinking ${(-s.vz).toFixed(1)} m/s at ${s.alt.toFixed(0)} m. Ease the throttle back toward centre before you touch down.`,
    };
  }

  if (reversals >= REVERSAL_LIMIT) {
    return {
      key: 'overcontrol',
      tone: 'warn',
      text: `${reversals} stick reversals in ${REVERSAL_WINDOW} s. That is chasing the drone. Smaller inputs, then give it a moment to respond.`,
    };
  }

  const grades = o?.grades ?? [];
  if (!grades.length) return null;

  let worst: { n: number; text: string; key: string } | null = null;
  let measured = 0;
  for (const g of grades) {
    const err = g.err(s, m);
    if (err == null) continue;
    measured++;
    const n = (err - g.good) / (g.bad - g.good);
    if (g.fix && n > 0.45 && (!worst || n > worst.n)) worst = { n, text: g.fix(s, m), key: g.label };
  }
  if (worst) return { key: worst.key, tone: 'fix', text: worst.text };
  if (measured === grades.length) {
    return { key: 'good', tone: 'good', text: 'On the numbers. Keep making the same small inputs.' };
  }
  return null;
}
