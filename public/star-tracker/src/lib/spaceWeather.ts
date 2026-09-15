// NOAA SWPC planetary K-index — free, public, no API key. Confirmed live at
// https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json,
// returning an array of { time_tag, Kp, a_running, station_count } rows.

export interface KpReading {
  time: string;
  kp: number;
}

// NOAA's own public interpretation of the standard planetary K-index scale
// (0-9, quiet to extreme geomagnetic storm), not an invented mapping.
export function describeKp(kp: number): string {
  if (kp < 4) return 'Quiet';
  if (kp < 5) return 'Unsettled';
  if (kp < 6) return 'Active';
  if (kp < 7) return 'Minor storm (G1)';
  if (kp < 8) return 'Moderate storm (G2)';
  if (kp < 9) return 'Strong storm (G3)';
  return 'Severe–extreme storm (G4–G5)';
}

export async function fetchLatestKp(): Promise<KpReading | null> {
  const res = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
  if (!res.ok) throw new Error(`Kp index fetch failed: ${res.status}`);
  const rows = (await res.json()) as { time_tag: string; Kp: number }[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return { time: last.time_tag, kp: last.Kp };
}
