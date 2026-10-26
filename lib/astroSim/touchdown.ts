// Mission 02, Lunar Touchdown: the descent model. Pure functions, so the whole
// landing can be tested without a browser. 1 unit = 1 metre, y is radar
// altitude, the site is at the origin and the ship arrives travelling toward -z.
//
// The profile follows the Apollo LM powered descent:
//   - powered descent starts about 50,000 ft up (15.2 km),
//   - braking burns off nearly all of the ~1.7 km/s orbital speed,
//   - "high gate" is near 7,600 ft (2.3 km), where the pitch-over shows the site,
//   - "low gate" is about 500 ft (150 m) and the final descent follows,
//   - touchdown must sit inside the LM gear's "doghouse": up to 10 ft/s (3.05 m/s)
//     sink with little sideways speed, or up to 4 ft/s (1.22 m/s) sideways when
//     the sink rate is 7 ft/s (2.13 m/s) or less.
// Braking is compressed from about 8 minutes to 45 s, and thrust and fuel are
// game-scaled. It is a simulation, not a flight-dynamics model.

export const MOON_G = 1.62; // m/s^2
export const T_MAX = 2.95; // m/s^2 at full throttle: hover sits near 55%
export const LAT_ACC = 2.0; // m/s^2 at full lateral stick
export const FUEL_PER_S = 0.42; // % per second at full throttle
export const LAT_FUEL = 0.1; // % per second at full lateral stick
export const START_ALT = 15240; // 50,000 ft
export const HIGH_GATE = 2316; // 7,600 ft
export const LOW_GATE = 152; // about 500 ft
export const BRAKE_SECONDS = 45;
export const BRAKE_THROTTLE = 0.75; // full braking progress at or above this
const END_HV = 68; // m/s of ground speed left at high gate
const END_VY = 43; // m/s of sink at high gate
const START_HV = 1680; // m/s, orbital speed
const A_BRAKE = (START_HV - END_HV) / BRAKE_SECONDS; // m/s^2 while the burn is held
const Z_END = 1800; // nominal range to the site at high gate
const Z_SLACK = 1500; // a little room for a wobble in the burn
const Z_START = Z_END + Z_SLACK + ((START_HV + END_HV) / 2) * BRAKE_SECONDS;
const Y_TAIL = END_VY * BRAKE_SECONDS;
const Y_BODY = START_ALT - HIGH_GATE - Y_TAIL;

export const SINK_LIMIT = 3.05; // 10 ft/s
export const SINK_FLAT = 2.13; // 7 ft/s
export const HORIZ_LIMIT = 1.22; // 4 ft/s

export type Phase = 'braking' | 'approach' | 'final' | 'landed' | 'crashed';
export type Rating = 'SOFT' | 'GOOD' | 'HARD';
export type CrashReason = 'SINK' | 'DRIFT' | 'FUEL';

export interface Result {
  outcome: 'landed' | 'crashed';
  /** sink rate at contact, m/s */
  sink: number;
  /** ground speed at contact, m/s */
  drift: number;
  /** distance from the marker, m */
  siteDist: number;
  rating: Rating | null;
  reason: CrashReason | null;
}

export interface Descent {
  t: number;
  phase: Phase;
  /** braking progress 0..1 */
  p: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuel: number;
  thr: number;
  /** smoothed lateral command, -1..1 (x: right, z: stick up = push back, against travel) */
  tx: number;
  tz: number;
  result: Result | null;
}

export interface DescentInput {
  /** throttle stick, -1..1, changes the throttle setting */
  thrIn: number;
  /** lateral stick, -1..1 */
  tx: number;
  tz: number;
  /** hands-off velocity damping */
  assist: boolean;
}

export function newDescent(): Descent {
  return { t: 0, phase: 'braking', p: 0, x: 0, y: START_ALT, z: Z_START, vx: 0, vy: 0, vz: -START_HV, fuel: 100, thr: 0.8, tx: 0, tz: 0, result: null };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Allowed ground speed at contact for a given sink rate (the doghouse). */
export function horizLimit(sink: number): number {
  if (sink <= SINK_FLAT) return HORIZ_LIMIT;
  return Math.max(0, (HORIZ_LIMIT * (SINK_LIMIT - sink)) / (SINK_LIMIT - SINK_FLAT));
}

function land(s: Descent) {
  const sink = Math.max(0, -s.vy);
  const drift = Math.hypot(s.vx, s.vz);
  const siteDist = Math.hypot(s.x, s.z);
  const okSink = sink <= SINK_LIMIT;
  const okDrift = drift <= horizLimit(sink);
  s.y = 0;
  if (okSink && okDrift) {
    s.phase = 'landed';
    s.result = { outcome: 'landed', sink, drift, siteDist, rating: sink <= 1 ? 'SOFT' : sink <= SINK_FLAT ? 'GOOD' : 'HARD', reason: null };
  } else {
    s.phase = 'crashed';
    const reason: CrashReason = s.fuel <= 0 ? 'FUEL' : !okSink ? 'SINK' : 'DRIFT';
    s.result = { outcome: 'crashed', sink, drift, siteDist, rating: null, reason };
  }
  s.vx = s.vy = s.vz = 0;
}

export function stepDescent(s: Descent, inp: DescentInput, dt: number): void {
  if (s.phase === 'landed' || s.phase === 'crashed' || dt <= 0) return;
  s.t += dt;
  s.thr = clamp(s.thr + inp.thrIn * dt * 0.35, 0, 1);
  const eff = s.fuel > 0 ? s.thr : 0; // engine out when the tanks are dry
  const ease = 1 - Math.exp(-dt * 2.2);
  s.tx += (inp.tx - s.tx) * ease;
  s.tz += (inp.tz - s.tz) * ease;

  if (s.phase === 'braking') {
    // The burn sheds ground speed while it is held high. Stop burning and the
    // ship simply keeps going, so the pilot overshoots the site. The altitude
    // follows the guidance curve for however much of the burn is done.
    const k = clamp((eff - 0.4) / (BRAKE_THROTTLE - 0.4), 0, 1);
    const speed = Math.max(END_HV, -s.vz - A_BRAKE * k * dt);
    s.vz = -speed;
    s.z += s.vz * dt;
    s.p = (START_HV - speed) / (START_HV - END_HV);
    const q = 1 - s.p;
    s.y = HIGH_GATE + Y_BODY * q * q + Y_TAIL * q;
    s.vy = -((2 * Y_BODY * q + Y_TAIL) / BRAKE_SECONDS) * k;
    s.fuel = Math.max(0, s.fuel - eff * FUEL_PER_S * dt);
    if (s.fuel <= 0 && s.p < 1) {
      s.phase = 'crashed';
      s.result = { outcome: 'crashed', sink: -s.vy, drift: speed, siteDist: Math.hypot(s.x, s.z), rating: null, reason: 'FUEL' };
      return;
    }
    if (s.p >= 1) {
      s.phase = 'approach';
      s.vy = -END_VY;
    }
    return;
  }

  const lat = Math.hypot(s.tx, s.tz);
  s.vy += (-MOON_G + eff * T_MAX) * dt;
  s.vx += s.tx * LAT_ACC * dt;
  s.vz += s.tz * LAT_ACC * dt;
  if (inp.assist && lat < 0.05) {
    // hands off: attitude hold bleeds off the drift
    const v = Math.hypot(s.vx, s.vz);
    if (v > 0) {
      const dv = Math.min(v, 1.0 * dt);
      s.vx -= (s.vx / v) * dv;
      s.vz -= (s.vz / v) * dv;
    }
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  s.fuel = Math.max(0, s.fuel - (eff * FUEL_PER_S + lat * LAT_FUEL) * dt);
  s.phase = s.y < LOW_GATE ? 'final' : 'approach';
  if (s.y <= 0) land(s);
}

/** Camera pitch (radians, negative looks down) for a given altitude: the pitch-over reveal. */
export function viewPitch(alt: number): number {
  const deg = (d: number) => (d * Math.PI) / 180;
  if (alt >= START_ALT - 1500) return deg(-4);
  const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (alt > HIGH_GATE) return deg(mix(-4, -50, ease((START_ALT - 1500 - alt) / (START_ALT - 1500 - HIGH_GATE))));
  if (alt > LOW_GATE) return deg(mix(-50, -65, ease((HIGH_GATE - alt) / (HIGH_GATE - LOW_GATE))));
  return deg(mix(-65, -55, ease((LOW_GATE - alt) / LOW_GATE)));
}
