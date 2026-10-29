// Mission 03, Deep Space Docking: the closing model. Pure functions, so the whole
// approach can be tested without a browser. 1 unit = 1 metre. The station's
// docking port sits at the origin facing +z; the drone starts out on the +z axis
// and closes along -z. x is right and y is up as seen from the drone's window.
//
// The procedure follows the real thing: a rendezvous that closes fast while it is
// far away and slows right down near the port, a speed corridor that tightens with
// range, and a final contact of a few centimetres a second. Real stations demand
// contact closing rates of roughly 0.03 to 0.1 m/s with the ports lined up to
// within centimetres; the numbers here are game-scaled and more forgiving, and the
// thrust, fuel and timeline are compressed. It is a simulation, not a model of
// any real spacecraft.

export const START_RANGE = 120;
export const START_X = 14;
export const START_Y = -8;
export const START_VZ = -1.5; // closing at 1.5 m/s
export const START_VX = 0.12; // a little drift, away from the axis
export const START_VY = 0.04;
export const THRUST = 0.25; // m/s^2 at full stick on any one axis
export const FUEL_PER_S = 1.4; // % per second with one axis at full stick
export const DAMP = 0.12; // m/s^2 of automatic rate damping when the slide sticks are idle
export const LOST_RANGE = 300; // drifted this far out and the approach is over

export const FAR_RANGE = 60; // inside this: the approach, line up the port
export const NEAR_RANGE = 10; // inside this: final closure

export const SPEED_LIMIT = 0.3; // m/s closing at contact
export const ALIGN_LIMIT = 0.5; // m of offset from the port axis at contact
export const SWAY_LIMIT = 0.15; // m/s sideways at contact

export type Phase = 'rendezvous' | 'approach' | 'final' | 'docked' | 'crashed';
export type Rating = 'SMOOTH' | 'GOOD' | 'FIRM';
export type CrashReason = 'SPEED' | 'ALIGN' | 'SWAY' | 'LOST';

export interface Result {
  outcome: 'docked' | 'crashed';
  /** closing rate at contact, m/s */
  closing: number;
  /** offset from the port axis at contact, m */
  offset: number;
  /** sideways speed at contact, m/s */
  sway: number;
  rating: Rating | null;
  reason: CrashReason | null;
}

export interface Dock {
  t: number;
  phase: Phase;
  x: number;
  y: number;
  /** distance to the port plane, m */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuel: number;
  /** smoothed stick commands, -1..1 */
  tx: number;
  ty: number;
  tz: number;
  result: Result | null;
}

export interface DockInput {
  /** closing stick, -1..1: positive pushes toward the port, negative brakes */
  close: number;
  /** slide sticks, -1..1 */
  sx: number;
  sy: number;
  /** rate damping when the slide sticks are idle */
  assist: boolean;
}

export function newDock(): Dock {
  return { t: 0, phase: 'rendezvous', x: START_X, y: START_Y, z: START_RANGE, vx: START_VX, vy: START_VY, vz: START_VZ, fuel: 100, tx: 0, ty: 0, tz: 0, result: null };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The speed corridor: how fast the drone may be closing at a given range, m/s. */
export function speedCorridor(range: number): number {
  return clamp(0.04 * range, 0.08, 1.5);
}

export function phaseOf(range: number): 'rendezvous' | 'approach' | 'final' {
  return range > FAR_RANGE ? 'rendezvous' : range > NEAR_RANGE ? 'approach' : 'final';
}

function contact(s: Dock) {
  const closing = Math.max(0, -s.vz);
  const offset = Math.hypot(s.x, s.y);
  const sway = Math.hypot(s.vx, s.vy);
  const okSpeed = closing <= SPEED_LIMIT;
  const okAlign = offset <= ALIGN_LIMIT;
  const okSway = sway <= SWAY_LIMIT;
  s.z = 0;
  if (okSpeed && okAlign && okSway) {
    s.phase = 'docked';
    const rating: Rating = closing <= 0.08 && offset <= 0.15 && sway <= 0.05 ? 'SMOOTH' : closing <= 0.2 && offset <= 0.3 ? 'GOOD' : 'FIRM';
    s.result = { outcome: 'docked', closing, offset, sway, rating, reason: null };
  } else {
    s.phase = 'crashed';
    const reason: CrashReason = !okAlign ? 'ALIGN' : !okSpeed ? 'SPEED' : 'SWAY';
    s.result = { outcome: 'crashed', closing, offset, sway, rating: null, reason };
  }
  s.vx = s.vy = s.vz = 0;
}

export function stepDock(s: Dock, inp: DockInput, dt: number): void {
  if (s.phase === 'docked' || s.phase === 'crashed' || dt <= 0) return;
  s.t += dt;
  const ease = 1 - Math.exp(-dt * 3);
  const live = s.fuel > 0 ? 1 : 0; // thrusters are dead once the tanks are dry
  s.tx += (inp.sx * live - s.tx) * ease;
  s.ty += (inp.sy * live - s.ty) * ease;
  s.tz += (inp.close * live - s.tz) * ease;

  s.vx += s.tx * THRUST * dt;
  s.vy += s.ty * THRUST * dt;
  s.vz -= s.tz * THRUST * dt;

  if (inp.assist && live) {
    // hands off the slide sticks: the autopilot bleeds off sideways drift
    for (const axis of ['x', 'y'] as const) {
      const key = axis === 'x' ? 'vx' : 'vy';
      const cmd = axis === 'x' ? s.tx : s.ty;
      if (Math.abs(cmd) < 0.05) {
        const dv = Math.min(Math.abs(s[key]), DAMP * dt);
        s[key] -= Math.sign(s[key]) * dv;
      }
    }
  }

  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  s.fuel = Math.max(0, s.fuel - (Math.abs(s.tx) + Math.abs(s.ty) + Math.abs(s.tz)) * FUEL_PER_S * dt);

  if (s.z <= 0) {
    contact(s);
    return;
  }
  if (s.z >= LOST_RANGE) {
    s.phase = 'crashed';
    s.result = { outcome: 'crashed', closing: 0, offset: Math.hypot(s.x, s.y), sway: Math.hypot(s.vx, s.vy), rating: null, reason: 'LOST' };
    return;
  }
  s.phase = phaseOf(s.z);
}
