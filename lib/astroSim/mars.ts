// Mission 04, Mars Sky-Crane Landing: entry, parachute, powered descent and the
// sky crane. Pure functions, so the whole landing can be tested without a
// browser. Metres and seconds throughout; y is altitude.
//
// The sequence follows the real Mars entry, descent and landing used for
// Curiosity and Perseverance:
//   - entry interface near 125 km at about 5.8 km/s, steered by tilting the
//     lift of the capsule up or down to land at the right distance downrange,
//   - the parachute opens near 11 km at roughly Mach 2 or less,
//   - the backshell separates and the descent engines light near 2 km,
//   - the descent stage hovers about 20 m up and lowers the rover on cables
//     (the real cable run is shorter and faster; this one is game-scaled),
//   - the cables are cut and the stage flies away.
// Seven real minutes are compressed: entry runs three times faster and the
// parachute stretch five times. The thrust, fuel and the dust-haze density
// bump are game-scaled. It is a simulation, not a flight-dynamics model.

export const R_MARS = 3389500;
export const G = 3.71; // m/s^2
export const RHO0 = 0.02; // kg/m^3 at the surface
export const H_SCALE = 11100; // m
export const BETA_BODY = 130; // kg/m^2, the capsule's ballistic coefficient
export const LIFT_DRAG = 0.24;
export const ENTRY_H = 125000;
export const ENTRY_V = 5800;
export const ENTRY_GAMMA = (15.0 * Math.PI) / 180; // flight path angle below the horizon
export const ENTRY_SCALE = 3;
export const CHUTE_SCALE = 3;
export const CHUTE_H = 11000;
export const CHUTE_V_MAX = 520; // the parachute tears past this
export const BETA_CHUTE = 14.4;
export const X_TARGET = 680000; // the downrange the entry is aiming for
export const RANGE_OK = 40000; // within this the landing site is easy to reach
export const RANGE_MAX = 60000; // outside this the site is out of reach
export const G_LIMIT = 14; // Earth g the capsule can take
export const SEP_AUTO = 900; // m: the backshell lets go by itself this low

export const T_MAX = 8.5; // m/s^2 at full throttle: hover sits near 44%
export const LAT_ACC = 2.5;
export const FUEL_PER_S = 0.8;
export const LAT_FUEL = 0.12;
export const CRANE_ALT = 25; // the sky crane can start at or below this altitude
export const CABLE = 20; // m of cable
export const CABLE_RATE = 1.6; // m/s
export const ROVER_HANG = 1.8; // m: the rover's base sits this far below the stage when stowed
export const SWAY_VY = 1.2; // m/s of vertical speed that makes the rover swing
export const SWAY_VH = 1.2; // m/s of drift that does the same
export const SWAY_MAX = 3; // seconds of swinging the cables can take
export const CUT_WINDOW = 15; // seconds to cut the cords once the rover is down
export const SITE_RADIUS = 60; // m: the crane must start this close to the marker

export type Phase = 'entry' | 'chute' | 'powered' | 'crane' | 'landed' | 'crashed';
export type Rating = 'PERFECT' | 'GOOD' | 'SAFE';
export type CrashReason = 'SKIP' | 'OVERLOAD' | 'FAST' | 'MISS' | 'GROUND' | 'SWING' | 'SNAG';

export interface Result {
  outcome: 'landed' | 'crashed';
  /** distance from the marker when the crane started (landed) or at the end, m */
  siteDist: number;
  /** seconds the cables swung */
  swing: number;
  /** propellant left, % */
  fuel: number;
  rating: Rating | null;
  reason: CrashReason | null;
}

export interface Mars {
  t: number;
  phase: Phase;
  /** along-track distance (entry) or downrange from the marker (after the parachute opens), m */
  x: number;
  /** altitude, m */
  y: number;
  /** crossrange from the marker, m */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** entry: speed and path angle */
  speed: number;
  gamma: number;
  /** the lift setpoint, -1 (down) to 1 (up) */
  lift: number;
  /** deceleration in Earth g */
  g: number;
  peakG: number;
  fuel: number;
  thr: number;
  tx: number;
  tz: number;
  /** cable paid out, m */
  cable: number;
  /** seconds the cables have been swinging */
  swing: number;
  /** mission clock when the rover touched down, or null */
  downAt: number | null;
  /** distance from the marker when the crane started */
  craneDist: number;
  result: Result | null;
}

export interface MarsInput {
  /** lift stick (entry), -1..1: changes the lift setpoint */
  lift: number;
  /** throttle stick (powered descent), -1..1: changes the throttle setting */
  thrIn: number;
  /** lateral sticks (powered descent) */
  tx: number;
  tz: number;
  /** autopilot holds drift down when the lateral sticks are idle */
  assist: boolean;
  /** the action button: separate the backshell, or cut the cords */
  action: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The dust haze: the real air is a bit thinner than the forecast around 55 km. */
function dust(h: number): number {
  return 1 - 0.15 * Math.exp(-(((h - 55000) / 12000) ** 2));
}

function density(h: number, haze: boolean): number {
  return RHO0 * Math.exp(-h / H_SCALE) * (haze ? dust(h) : 1);
}

export function newMars(): Mars {
  return {
    t: 0, phase: 'entry', x: 0, y: ENTRY_H, z: 0, vx: ENTRY_V * Math.cos(ENTRY_GAMMA), vy: -ENTRY_V * Math.sin(ENTRY_GAMMA), vz: 0,
    speed: ENTRY_V, gamma: ENTRY_GAMMA, lift: 0.5, g: 0, peakG: 0, fuel: 100, thr: 0, tx: 0, tz: 0, cable: 0, swing: 0, downAt: null, craneDist: 0, result: null,
  };
}

interface EntryOut {
  speed: number;
  x: number;
  gamma: number;
  t: number;
  peakG: number;
}

/** Fly the entry forward holding one lift setting; used by the HUD predictor and the tests. */
export function predictEntry(from: Pick<Mars, 'y' | 'speed' | 'gamma' | 'x'>, lift: number, haze = false): EntryOut | null {
  let h = from.y, V = from.speed, g = from.gamma, x = from.x, t = 0, pk = 0;
  const dt = 0.25;
  while (h > CHUTE_H && t < 900) {
    const rho = density(h, haze);
    const D = (rho * V * V) / (2 * BETA_BODY);
    V += (-D + G * Math.sin(g)) * dt;
    g += (((G * Math.cos(g) - (V * V * Math.cos(g)) / (R_MARS + h) - LIFT_DRAG * D * lift) / V)) * dt;
    h -= V * Math.sin(g) * dt;
    x += V * Math.cos(g) * dt;
    t += dt;
    pk = Math.max(pk, D / 9.81);
    if (h > ENTRY_H + 15000 && t > 5) return null; // skipped out
  }
  return { speed: V, x, gamma: g, t, peakG: pk };
}

/** How far the chute stage carries the drone downrange from the deploy point, from a nominal deploy. Computed once. */
const NOMINAL_DRIFT = (() => {
  let y = CHUTE_H, vx = 450 * Math.cos(0.4), vy = -450 * Math.sin(0.4), x = 0;
  const dt = 0.05;
  while (y > 1900) {
    const v = Math.hypot(vx, vy);
    const k = (density(y, false) * v) / (2 * BETA_CHUTE);
    vx += -k * vx * dt;
    vy += (-G - k * vy) * dt;
    x += vx * dt;
    y += vy * dt;
  }
  return x;
})();

export const CHUTE_DRIFT = NOMINAL_DRIFT;

function rebase(s: Mars) {
  // The landing site is chosen after the parachute opens, so the world is re-anchored
  // on the marker. A long or short entry only nudges where the drone starts.
  const err = s.x - X_TARGET;
  s.x = -NOMINAL_DRIFT + err * 0.012;
  s.z = 120 + err * 0.004;
  s.vz = 0;
}

function finish(s: Mars, outcome: 'landed' | 'crashed', reason: CrashReason | null, rating: Rating | null) {
  s.phase = outcome;
  s.result = { outcome, siteDist: outcome === 'landed' ? s.craneDist : Math.hypot(s.x, s.z), swing: s.swing, fuel: s.fuel, rating, reason };
}

function stepEntry(s: Mars, inp: MarsInput, dt: number) {
  const sdt = dt * ENTRY_SCALE;
  s.lift = clamp(s.lift + inp.lift * dt * 0.6, -1, 1);
  const n = Math.max(1, Math.ceil(sdt / 0.05));
  const h = sdt / n;
  for (let i = 0; i < n; i++) {
    const rho = density(s.y, true);
    const D = (rho * s.speed * s.speed) / (2 * BETA_BODY);
    s.speed += (-D + G * Math.sin(s.gamma)) * h;
    s.gamma += ((G * Math.cos(s.gamma) - (s.speed * s.speed * Math.cos(s.gamma)) / (R_MARS + s.y) - LIFT_DRAG * D * s.lift) / s.speed) * h;
    s.y -= s.speed * Math.sin(s.gamma) * h;
    s.x += s.speed * Math.cos(s.gamma) * h;
    s.g = D / 9.81;
    s.peakG = Math.max(s.peakG, s.g);
    s.t += h;
    s.vx = s.speed * Math.cos(s.gamma);
    s.vy = -s.speed * Math.sin(s.gamma);
    if (s.g > G_LIMIT) {
      finish(s, 'crashed', 'OVERLOAD', null);
      return;
    }
    if (s.y > ENTRY_H + 10000 && s.t > 8) {
      finish(s, 'crashed', 'SKIP', null);
      return;
    }
    if (s.y <= CHUTE_H) {
      const err = Math.abs(s.x - X_TARGET);
      if (s.speed > CHUTE_V_MAX) finish(s, 'crashed', 'FAST', null);
      else if (err > RANGE_MAX) finish(s, 'crashed', 'MISS', null);
      else {
        s.phase = 'chute';
        s.g = 0;
        rebase(s);
      }
      return;
    }
  }
}

function separate(s: Mars) {
  s.phase = 'powered';
  s.thr = 0.45;
  s.tx = s.tz = 0;
}

function stepChute(s: Mars, inp: MarsInput, dt: number) {
  const sdt = dt * CHUTE_SCALE;
  const n = Math.max(1, Math.ceil(sdt / 0.05));
  const h = sdt / n;
  for (let i = 0; i < n; i++) {
    const v = Math.hypot(s.vx, s.vy);
    const k = (density(Math.max(0, s.y), false) * v) / (2 * BETA_CHUTE);
    s.vx += -k * s.vx * h;
    s.vy += (-G - k * s.vy) * h;
    s.x += s.vx * h;
    s.y += s.vy * h;
    s.t += h;
    s.g = Math.hypot(k * s.vx, k * s.vy + G) / 9.81;
    if (inp.action || s.y <= SEP_AUTO) {
      separate(s);
      break;
    }
  }
}

function groundSpeed(s: Mars) {
  return Math.hypot(s.vx, s.vz);
}

function stepPowered(s: Mars, inp: MarsInput, dt: number) {
  s.t += dt;
  s.thr = clamp(s.thr + inp.thrIn * dt * 0.35, 0, 1);
  const eff = s.fuel > 0 ? s.thr : 0;
  const ease = 1 - Math.exp(-dt * 2.2);
  s.tx += (inp.tx - s.tx) * ease;
  s.tz += (inp.tz - s.tz) * ease;
  const lat = Math.hypot(s.tx, s.tz);
  s.vy += (-G + eff * T_MAX) * dt;
  s.vx += s.tx * LAT_ACC * dt;
  s.vz += s.tz * LAT_ACC * dt;
  if (inp.assist && lat < 0.05) {
    const v = groundSpeed(s);
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
  s.g = (eff * T_MAX) / 9.81;
}

export function stepMars(s: Mars, inp: MarsInput, dt: number): void {
  if (s.phase === 'landed' || s.phase === 'crashed' || dt <= 0) return;
  if (s.phase === 'entry') {
    stepEntry(s, inp, dt);
    return;
  }
  if (s.phase === 'chute') {
    stepChute(s, inp, dt);
    return;
  }
  stepPowered(s, inp, dt);

  if (s.phase === 'powered') {
    const siteDist = Math.hypot(s.x, s.z);
    if (s.y <= CRANE_ALT && s.y > 8 && Math.abs(s.vy) <= 2 && groundSpeed(s) <= 2 && siteDist <= SITE_RADIUS) {
      s.phase = 'crane';
      s.craneDist = siteDist;
      s.cable = 0;
    }
    if (s.y <= 0) {
      s.y = 0;
      finish(s, 'crashed', 'GROUND', null);
    }
    return;
  }

  // the crane: the cables pay out, the stage has to hold still, then cut
  s.cable = Math.min(CABLE, s.cable + CABLE_RATE * dt);
  if (Math.abs(s.vy) > SWAY_VY || groundSpeed(s) > SWAY_VH) s.swing += dt;
  if (s.swing > SWAY_MAX) {
    finish(s, 'crashed', 'SWING', null);
    return;
  }
  if (s.downAt === null && (s.cable >= CABLE || s.y - ROVER_HANG - s.cable <= 0.3)) s.downAt = s.t;
  if (s.y <= 0.5) {
    s.y = 0.5;
    finish(s, 'crashed', 'GROUND', null);
    return;
  }
  if (s.downAt !== null) {
    if (inp.action) {
      const rating: Rating = s.craneDist <= 15 && s.swing < 0.5 ? 'PERFECT' : s.craneDist <= 40 ? 'GOOD' : 'SAFE';
      finish(s, 'landed', null, rating);
    } else if (s.t - s.downAt > CUT_WINDOW) {
      finish(s, 'crashed', 'SNAG', null);
    }
  }
}
