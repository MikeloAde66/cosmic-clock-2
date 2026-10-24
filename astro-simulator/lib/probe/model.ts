// Atmosphere-descent game model. SIM ONLY: the profiles below are smooth
// textbook-style approximations (Venus: CO2, ~8 K/km lapse; Jupiter: H2/He,
// ~2 K/km adiabat from 165 K at 1 bar) tuned so headline figures land near
// the known ones (Venus surface ~92 bar / 737 K; Galileo probe ~22 bar /
// ~426 K at ~130 km below the 1-bar level). They are not mission data.

export type PlanetId = 'venus' | 'jupiter';

export interface Planet {
  id: PlanetId;
  name: string;
  g: number; // m/s^2
  molarMass: number; // kg/mol
  startKm: number; // entry interface altitude
  floorKm: number; // lowest altitude (surface for Venus, arbitrary for Jupiter)
  pTopBar: number; // pressure at startKm
  temp: (hKm: number) => number; // K
  wind: (hKm: number) => number; // m/s mean zonal wind
  hullPressureBar: number; // rated external pressure
  hullTempK: number; // rated hull temperature
  goal: string;
}

const R = 8.314462;

const venusTemp = (h: number) => (h <= 50 ? 737 - 7.74 * h : 350 - (h - 50) * 5.5);
const jupiterTemp = (h: number) => (h >= 0 ? Math.max(110, 165 - 2.2 * h) : 165 - 2.0 * h);

export const PLANETS: Record<PlanetId, Planet> = {
  venus: {
    id: 'venus',
    name: 'Venus',
    g: 8.87,
    molarMass: 0.04345,
    startKm: 70,
    floorKm: 0,
    pTopBar: 0.0443,
    temp: venusTemp,
    wind: (h) => 1 + 99 * Math.pow(Math.max(0, h) / 70, 1.6),
    hullPressureBar: 110,
    hullTempK: 790,
    goal: 'Reach the surface with the hull intact, then hold for 30 s of transmission.',
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jupiter',
    g: 24.79,
    molarMass: 0.00222,
    startKm: 40,
    floorKm: -400,
    pTopBar: 0.12,
    temp: jupiterTemp,
    wind: (h) => (h > 0 ? 40 + 50 * (1 - Math.exp(-(40 - h) / 20)) : 90 + 80 * (1 - Math.exp(h / 40))),
    hullPressureBar: 26,
    hullTempK: 470,
    goal: 'Dive as deep as you can. There is no surface; the hull will eventually give way. Score is depth in bar.',
  },
};

// Hydrostatic pressure table (bar), integrated downward from the top, 0.1 km steps.
const STEP_KM = 0.1;
const tables: Record<PlanetId, { start: number; p: Float64Array }> = {} as never;

function table(pl: Planet) {
  let t = tables[pl.id];
  if (t) return t;
  const n = Math.round((pl.startKm - pl.floorKm) / STEP_KM) + 1;
  const p = new Float64Array(n);
  p[0] = pl.pTopBar;
  for (let i = 1; i < n; i++) {
    const h = pl.startKm - (i - 0.5) * STEP_KM;
    const dlnP = (pl.g * pl.molarMass * STEP_KM * 1000) / (R * pl.temp(h));
    p[i] = p[i - 1] * Math.exp(dlnP);
  }
  t = tables[pl.id] = { start: pl.startKm, p };
  return t;
}

export function pressureBar(pl: Planet, hKm: number): number {
  const t = table(pl);
  const x = Math.min(t.p.length - 1, Math.max(0, (t.start - hKm) / STEP_KM));
  const i = Math.floor(x);
  const f = x - i;
  const a = t.p[i];
  const b = t.p[Math.min(t.p.length - 1, i + 1)];
  return Math.exp(Math.log(a) * (1 - f) + Math.log(b) * f);
}

export function densityKgM3(pl: Planet, hKm: number): number {
  return (pressureBar(pl, hKm) * 1e5 * pl.molarMass) / (R * pl.temp(hKm));
}

export interface Probe {
  hKm: number;
  vMs: number; // downward speed
  hullTempK: number;
  integrity: number; // 0..100
  chute: boolean;
  chuteShocks: number;
  coolant: number; // 0..100
  coolantOn: boolean;
  t: number; // elapsed sim seconds
  maxBar: number;
  surfaceTime: number;
  status: 'descending' | 'landed' | 'lost';
  cause?: string;
}

const MASS = 340; // kg (Galileo probe class)
const CD_BODY = 1.0;
const AREA_BODY = 1.27;
const CD_CHUTE = 1.5;
const AREA_CHUTE = 18;
const CHUTE_SHOCK_PA = 3500;
const SAFE_LANDING_MS = 4;

export function newProbe(pl: Planet): Probe {
  return {
    hKm: pl.startKm,
    vMs: pl.id === 'venus' ? 250 : 600,
    hullTempK: pl.temp(pl.startKm),
    integrity: 100,
    chute: false,
    chuteShocks: 0,
    coolant: 100,
    coolantOn: false,
    t: 0,
    maxBar: pressureBar(pl, pl.startKm),
    surfaceTime: 0,
    status: 'descending',
  };
}

export function deployChute(p: Probe, pl: Planet): void {
  if (p.status !== 'descending' || p.chute) return;
  p.chute = true;
  const q = 0.5 * densityKgM3(pl, p.hKm) * p.vMs * p.vMs;
  if (q > CHUTE_SHOCK_PA) {
    p.integrity -= Math.min(60, (q - CHUTE_SHOCK_PA) / 80);
    p.chuteShocks++;
  }
}

export function jettisonChute(p: Probe): void {
  p.chute = false;
}

/** Instantaneous gust speed: mean wind plus a deterministic turbulence term. */
export function gustMs(pl: Planet, hKm: number, t: number): number {
  const mean = pl.wind(hKm);
  return mean * (1 + 0.35 * Math.sin(t * 0.9 + hKm) * Math.sin(t * 0.37));
}

/** Advance the probe by dt seconds of sim time (call with small dt). */
export function stepProbe(p: Probe, pl: Planet, dt: number): void {
  if (p.status !== 'descending') return;
  const rho = densityKgM3(pl, p.hKm);
  const cdA = CD_BODY * AREA_BODY + (p.chute ? CD_CHUTE * AREA_CHUTE : 0);
  // Semi-implicit in the drag term so dense-atmosphere steps stay stable at large dt.
  const c = (0.5 * rho * cdA) / MASS;
  p.vMs = (p.vMs + pl.g * dt) / (1 + c * Math.abs(p.vMs) * dt);
  p.hKm -= (p.vMs * dt) / 1000;
  p.t += dt;

  const ambient = pl.temp(p.hKm);
  const tau = p.coolantOn && p.coolant > 0 ? 2400 : 900;
  p.hullTempK += ((ambient - p.hullTempK) / tau) * dt;
  if (p.coolantOn) p.coolant = Math.max(0, p.coolant - dt * 0.05);

  const bar = pressureBar(pl, p.hKm);
  p.maxBar = Math.max(p.maxBar, bar);

  let dmg = 0;
  if (p.hullTempK > pl.hullTempK) dmg += (p.hullTempK - pl.hullTempK) * 0.004;
  if (bar > pl.hullPressureBar) dmg += (bar / pl.hullPressureBar - 1) * 6 + 0.5;
  // Buffeting: dynamic pressure of gusts on the body, only damaging when severe.
  // The probe drifts with the mean wind, so only the gust variation loads it.
  const gust = gustMs(pl, p.hKm, p.t) - pl.wind(p.hKm);
  const buffet = 0.5 * rho * gust * gust;
  if (buffet > 2500) dmg += (buffet - 2500) / 4000;
  p.integrity = Math.max(0, p.integrity - dmg * dt);

  if (p.integrity <= 0) {
    p.status = 'lost';
    p.cause =
      bar > pl.hullPressureBar ? 'Crushed by external pressure' : p.hullTempK > pl.hullTempK ? 'Hull overheated' : 'Broken up by shock or buffeting';
    return;
  }
  if (p.hKm <= pl.floorKm) {
    p.hKm = pl.floorKm;
    if (pl.id === 'venus') {
      // Touchdown above SAFE_LANDING_MS hurts: keep the chute for the last stretch.
      if (p.surfaceTime === 0 && p.vMs > SAFE_LANDING_MS) p.integrity = Math.max(1, p.integrity - (p.vMs - SAFE_LANDING_MS) * 10);
      p.vMs = 0;
      p.surfaceTime += dt;
      if (p.surfaceTime >= 30) p.status = 'landed';
    } else {
      p.status = 'lost';
      p.cause = 'Simulation floor reached';
    }
  }
}
