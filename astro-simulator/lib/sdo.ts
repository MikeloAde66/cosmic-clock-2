// NASA Solar Dynamics Observatory "latest image" URLs. They are loaded
// straight into <img> in the browser (no CORS needed for display). The
// files are replaced roughly every 15 minutes (white light / magnetogram)
// to a few minutes (AIA channels), so the page re-requests on a timer.
export interface SdoFilter {
  code: string;
  label: string;
  note: string;
  /** Rough tint for the SIM fallback only. */
  tint: [number, number, number];
}

export const SDO_FILTERS: SdoFilter[] = [
  { code: 'HMIIF', label: 'White light', note: 'HMI continuum: what the eye would see, sunspots included.', tint: [255, 190, 90] },
  { code: '0304', label: '304 Å', note: 'AIA He II, ~50,000 K: chromosphere and prominences. Shown in red by convention.', tint: [255, 70, 40] },
  { code: '0171', label: '171 Å', note: 'AIA Fe IX, ~600,000 K: quiet corona and coronal loops.', tint: [255, 200, 80] },
  { code: '0193', label: '193 Å', note: 'AIA Fe XII, ~1.2 MK: corona and coronal holes.', tint: [200, 160, 110] },
  { code: '0211', label: '211 Å', note: 'AIA Fe XIV, ~2 MK: hot active regions.', tint: [170, 90, 170] },
  { code: '0131', label: '131 Å', note: 'AIA Fe VIII/XXI, up to ~10 MK: flaring regions.', tint: [60, 200, 200] },
  { code: '0094', label: '94 Å', note: 'AIA Fe XVIII, ~6 MK: flare plasma.', tint: [90, 200, 90] },
  { code: '1600', label: '1600 Å', note: 'AIA C IV + continuum: upper photosphere / transition region.', tint: [220, 220, 120] },
  { code: 'HMIB', label: 'Magnetogram', note: 'HMI line-of-sight magnetic field. White/black = opposite polarity.', tint: [180, 180, 180] },
];

export const SDO_BASE = 'https://sdo.gsfc.nasa.gov/assets/img/latest';

export function sdoUrl(code: string, size: 512 | 1024 | 2048, bust: number): string {
  return `${SDO_BASE}/latest_${size}_${code}.jpg?t=${bust}`;
}
