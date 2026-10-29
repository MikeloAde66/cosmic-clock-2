// Mission 05, First Rover Drive: rover Wren unstows, drives a short traverse
// across the landing patch to three science targets, then sends the data home
// through a relay. Pure functions, so the whole drive can be tested without a
// browser. Metres and seconds throughout; the patch is flat apart from craters.
//
// The procedure follows how real rovers work: unstow the mast and panels, drive
// in short careful legs around rocks and sand, stop and hold still to sample,
// and uplink through an orbiter when the antenna can see it. The speeds, the
// battery and the hazards are game-scaled: the real rover crawls at centimetres
// per second. It is a simulation, not a vehicle-dynamics model.

export const V_MAX = 2.4; // m/s forward
export const V_REV = 1.0; // m/s in reverse
export const ACCEL = 1.6;
export const BRAKE = 2.4;
export const TURN = 1.1; // rad/s at a standstill
export const ROVER_R = 1.3; // m, the rover's footprint
export const ROCK_SAFE = 0.6; // m/s: a bump slower than this does no damage
export const ROCK_HIT = 22; // damage per m/s above the safe speed
export const ROCK_BASE = 6; // damage for any hard hit
export const DAMAGE_MAX = 100;
export const TILT_WARN = 18; // degrees
export const TILT_MAX = 27; // degrees: sustained tilt past this tips the rover
export const TILT_TIME = 1.0; // seconds past the limit before it goes over
export const PIT_SLOW = 0.35; // speed factor in soft sand
export const PIT_STUCK = 6; // seconds of crawling in sand before the wheels dig in
export const SAMPLE_R = 4.5; // m from a target to sample it
export const SAMPLE_T = 3; // s holding still
export const RELAY_R = 6; // m from the relay point to uplink
export const UPLINK_T = 6; // s holding still
export const UNSTOW_T = 6; // s
export const STILL_V = 0.3; // m/s: slow enough to start sampling or uplink

export const BATT_BASE = 0.06; // % per second just being awake
export const BATT_DRIVE = 0.2; // % per second at full speed
export const BATT_SAMPLE = 1.4; // % per second while sampling
export const BATT_UPLINK = 1.2; // % per second while uplinking
export const BATT_UNSTOW = 0.5;

export type Phase = 'stowed' | 'driving' | 'complete' | 'failed';
export type Activity = 'none' | 'unstow' | 'sample' | 'uplink';
export type Rating = 'PERFECT' | 'GOOD' | 'SAFE';
export type FailReason = 'WHEELS' | 'ROLLOVER' | 'STUCK' | 'BATTERY';

export interface Target {
  name: string;
  x: number;
  z: number;
}

/** Wren lands at the origin facing +x; the traverse runs out and loops back to the relay point. */
export const TARGETS: Target[] = [
  { name: 'RED OUTCROP', x: 48, z: 12 },
  { name: 'LAYERED ROCK', x: 90, z: -40 },
  { name: 'DARK DUNE', x: 50, z: -82 },
];
export const RELAY: Target = { name: 'RELAY POINT', x: -4, z: -62 };

export interface Rock {
  x: number;
  z: number;
  r: number;
}

/** Boulders the wheels cannot go over. */
export const ROCKS: Rock[] = [
  { x: 14, z: 0, r: 1.7 },
  { x: 24, z: 1, r: 1.3 },
  { x: 36, z: 22, r: 2.0 },
  { x: 40, z: 4, r: 1.5 },
  { x: 58, z: 2, r: 1.8 },
  { x: 78, z: -28, r: 1.6 },
  { x: 84, z: -52, r: 2.1 },
  { x: 70, z: -48, r: 1.2 },
  { x: 62, z: -92, r: 1.9 },
  { x: 38, z: -96, r: 1.5 },
  { x: 36, z: -69, r: 1.7 },
  { x: 14, z: -78, r: 1.4 },
  { x: 8, z: -52, r: 1.8 },
  { x: 24, z: -36, r: 1.3 },
  { x: 0, z: -30, r: 2.2 },
  { x: -18, z: -60, r: 1.6 },
];

export interface Pit {
  x: number;
  z: number;
  r: number;
}

/** Soft sand: slow, and it digs in if you crawl. */
export const PITS: Pit[] = [
  { x: 28, z: -16, r: 9 },
  { x: 28, z: -74, r: 10 },
];

export interface Crater {
  x: number;
  z: number;
  /** rim radius, m */
  r: number;
  /** depth, m */
  d: number;
}

/** The first is steep enough to tip the rover; the second can be crossed. */
export const CRATERS: Crater[] = [
  { x: 68, z: -10, r: 15, d: 7 },
  { x: 72, z: -68, r: 18, d: 3 },
];

export interface Result {
  outcome: 'complete' | 'failed';
  rating: Rating | null;
  reason: FailReason | null;
  battery: number;
  damage: number;
  samples: number;
  /** distance driven, m */
  distance: number;
}

export interface Rover {
  t: number;
  phase: Phase;
  x: number;
  z: number;
  /** radians; forward is (cos, sin) in (x, z); steering right turns it up */
  heading: number;
  /** signed forward speed, m/s */
  v: number;
  /** actual turn rate, rad/s */
  yaw: number;
  battery: number;
  damage: number;
  /** degrees */
  tilt: number;
  /** slope along and across the heading, as angles in radians, for drawing */
  pitch: number;
  roll: number;
  tiltT: number;
  sink: number;
  samples: boolean[];
  activity: Activity;
  /** seconds into the current activity */
  actT: number;
  /** which target is being sampled */
  actIdx: number;
  /** unstow progress, 0..1 */
  panels: number;
  uplinked: boolean;
  /** how many times a sample or uplink was interrupted */
  aborts: number;
  distance: number;
  /** bumps felt this tick, for the scene to shake */
  bump: number;
  result: Result | null;
}

export interface RoverInput {
  /** -1 (reverse) to 1 (forward) */
  drive: number;
  /** -1 (left) to 1 (right) */
  steer: number;
  /** hazard brake: crawl when a boulder is close ahead */
  assist: boolean;
  /** unstow, sample, or uplink, whichever applies */
  action: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function newRover(): Rover {
  return {
    t: 0, phase: 'stowed', x: 0, z: 0, heading: 0, v: 0, yaw: 0, battery: 100, damage: 0, tilt: 0, pitch: 0, roll: 0, tiltT: 0, sink: 0,
    samples: TARGETS.map(() => false), activity: 'none', actT: 0, actIdx: -1, panels: 0, uplinked: false, aborts: 0, distance: 0, bump: 0, result: null,
  };
}

/** Ground height: flat, except the craters. */
export function terrainH(x: number, z: number): number {
  let h = 0;
  for (const c of CRATERS) {
    const u = Math.hypot(x - c.x, z - c.z) / c.r;
    if (u < 1) h -= c.d * (1 - u * u) ** 2;
  }
  return h;
}

export function slopeAt(x: number, z: number): { gx: number; gz: number } {
  const e = 0.25;
  return { gx: (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), gz: (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e) };
}

export function inPit(x: number, z: number): boolean {
  return PITS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r);
}

/** The next thing to do: the first target not yet sampled, or the relay point. */
export function nextTarget(s: Pick<Rover, 'samples'>): { target: Target; index: number; relay: boolean } {
  const i = s.samples.findIndex((d) => !d);
  return i >= 0 ? { target: TARGETS[i], index: i, relay: false } : { target: RELAY, index: TARGETS.length, relay: true };
}

export function distTo(s: Pick<Rover, 'x' | 'z'>, t: { x: number; z: number }): number {
  return Math.hypot(t.x - s.x, t.z - s.z);
}

function fail(s: Rover, reason: FailReason) {
  s.phase = 'failed';
  s.v = 0;
  s.yaw = 0;
  s.activity = 'none';
  s.result = { outcome: 'failed', rating: null, reason, battery: s.battery, damage: s.damage, samples: s.samples.filter(Boolean).length, distance: s.distance };
}

function complete(s: Rover) {
  s.phase = 'complete';
  s.v = 0;
  s.yaw = 0;
  s.activity = 'none';
  const rating: Rating = s.damage < 5 && s.battery >= 35 ? 'PERFECT' : s.damage < 40 && s.battery >= 15 ? 'GOOD' : 'SAFE';
  s.result = { outcome: 'complete', rating, reason: null, battery: s.battery, damage: s.damage, samples: TARGETS.length, distance: s.distance };
}

export function stepRover(s: Rover, inp: RoverInput, dt: number): void {
  if (s.phase === 'complete' || s.phase === 'failed' || dt <= 0) return;
  s.t += dt;
  s.bump = Math.max(0, s.bump - dt * 3);

  // what the battery is feeding
  let drain = BATT_BASE;
  if (s.activity === 'unstow') drain += BATT_UNSTOW;
  if (s.activity === 'sample') drain += BATT_SAMPLE;
  if (s.activity === 'uplink') drain += BATT_UPLINK;
  drain += BATT_DRIVE * (Math.abs(s.v) / V_MAX) * (inPit(s.x, s.z) ? 1.8 : 1);
  s.battery = Math.max(0, s.battery - drain * dt);
  if (s.battery <= 0) {
    fail(s, 'BATTERY');
    return;
  }

  if (s.phase === 'stowed') {
    if (s.activity === 'none' && inp.action) s.activity = 'unstow';
    if (s.activity === 'unstow') {
      s.actT += dt;
      s.panels = clamp(s.actT / UNSTOW_T, 0, 1);
      if (s.actT >= UNSTOW_T) {
        s.phase = 'driving';
        s.activity = 'none';
        s.actT = 0;
      }
    }
    return;
  }

  // sampling and uplinking need the rover to hold still: any drive input stops them
  const busy = s.activity === 'sample' || s.activity === 'uplink';
  const moving = Math.abs(inp.drive) > 0.1 || Math.abs(inp.steer) > 0.1;
  if (busy && moving) {
    s.activity = 'none';
    s.actT = 0;
    s.aborts++;
  }

  const holding = s.activity !== 'none';
  const next = nextTarget(s);
  if (!holding && inp.action && Math.abs(s.v) <= STILL_V) {
    if (!next.relay && distTo(s, next.target) <= SAMPLE_R) {
      s.activity = 'sample';
      s.actIdx = next.index;
      s.actT = 0;
    } else if (next.relay && distTo(s, RELAY) <= RELAY_R) {
      s.activity = 'uplink';
      s.actT = 0;
    }
  }

  // speed
  const hold = s.activity !== 'none';
  const pit = inPit(s.x, s.z);
  const sl = slopeAt(s.x, s.z);
  const fx = Math.cos(s.heading), fz = Math.sin(s.heading);
  const along = sl.gx * fx + sl.gz * fz;
  let vt = hold ? 0 : inp.drive >= 0 ? inp.drive * V_MAX : inp.drive * V_REV;
  if (vt !== 0) {
    vt *= clamp(1 - 2 * along * Math.sign(vt), 0.25, 1.4);
    if (pit) vt *= PIT_SLOW;
  }
  if (inp.assist && vt > 0) {
    // crawl when a boulder is close and ahead
    for (const r of ROCKS) {
      const dx = r.x - s.x, dz = r.z - s.z;
      const dist = Math.hypot(dx, dz);
      const gap = dist - r.r - ROVER_R;
      if (gap < 5 && (dx * fx + dz * fz) / (dist || 1) > 0.5) vt = Math.min(vt, Math.max(0.35, 0.35 + gap * 0.4));
    }
  }
  const dv = vt - s.v;
  s.v += clamp(dv, -BRAKE * dt, ACCEL * dt);

  // steering: a skid-steer rover can turn on the spot, a little slower at speed
  const yawT = hold ? 0 : inp.steer * TURN * (1 - 0.4 * (Math.abs(s.v) / V_MAX));
  s.yaw += (yawT - s.yaw) * (1 - Math.exp(-dt * 8));
  s.heading += s.yaw * dt;

  const nx = s.x + Math.cos(s.heading) * s.v * dt;
  const nz = s.z + Math.sin(s.heading) * s.v * dt;
  s.distance += Math.abs(s.v) * dt;
  s.x = nx;
  s.z = nz;

  // boulders
  for (const r of ROCKS) {
    const dx = s.x - r.x, dz = s.z - r.z;
    const dist = Math.hypot(dx, dz);
    const min = r.r + ROVER_R;
    if (dist < min) {
      const nxn = dx / (dist || 1), nzn = dz / (dist || 1);
      s.x = r.x + nxn * min;
      s.z = r.z + nzn * min;
      const into = -(Math.cos(s.heading) * nxn + Math.sin(s.heading) * nzn) * s.v;
      if (into > ROCK_SAFE) {
        s.damage += (into - ROCK_SAFE) * ROCK_HIT + ROCK_BASE;
        s.bump = 1;
        s.v *= -0.2;
      } else if (into > 0) {
        s.v = 0;
      }
    }
  }
  if (s.damage >= DAMAGE_MAX) {
    s.damage = DAMAGE_MAX;
    fail(s, 'WHEELS');
    return;
  }

  // tilt and sand
  const here = slopeAt(s.x, s.z);
  const fx2 = Math.cos(s.heading), fz2 = Math.sin(s.heading);
  s.pitch = Math.atan(here.gx * fx2 + here.gz * fz2);
  s.roll = Math.atan(-here.gx * fz2 + here.gz * fx2);
  s.tilt = (Math.atan(Math.hypot(here.gx, here.gz)) * 180) / Math.PI;
  s.tiltT = s.tilt > TILT_MAX ? s.tiltT + dt : Math.max(0, s.tiltT - dt);
  if (s.tiltT > TILT_TIME) {
    fail(s, 'ROLLOVER');
    return;
  }
  if (inPit(s.x, s.z) && Math.abs(s.v) < 0.5) s.sink += dt;
  else s.sink = Math.max(0, s.sink - dt * 1.5);
  if (s.sink > PIT_STUCK) {
    fail(s, 'STUCK');
    return;
  }

  // sampling and uplink progress
  if (s.activity === 'sample') {
    s.actT += dt;
    if (s.actT >= SAMPLE_T) {
      s.samples[s.actIdx] = true;
      s.activity = 'none';
      s.actT = 0;
    }
  } else if (s.activity === 'uplink') {
    s.actT += dt;
    if (s.actT >= UPLINK_T) {
      s.uplinked = true;
      complete(s);
    }
  }
}

export type HazardKind = 'rock' | 'pit' | 'crater';

/** The closest hazard within warning range, for the radio and the cockpit. */
export function nearestHazard(s: Pick<Rover, 'x' | 'z'>): { kind: HazardKind; gap: number } | null {
  let best: { kind: HazardKind; gap: number } | null = null;
  const take = (kind: HazardKind, gap: number, range: number) => {
    if (gap < range && (!best || gap < best.gap)) best = { kind, gap };
  };
  for (const r of ROCKS) take('rock', Math.hypot(s.x - r.x, s.z - r.z) - r.r - ROVER_R, 6);
  for (const p of PITS) take('pit', Math.hypot(s.x - p.x, s.z - p.z) - p.r, 8);
  // only the steep crater is a hazard
  for (const c of CRATERS) if (c.d / c.r > 0.3) take('crater', Math.hypot(s.x - c.x, s.z - c.z) - c.r, 10);
  return best;
}
