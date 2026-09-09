import { SiderealTime } from 'astronomy-engine';

// Local Sidereal Time = Greenwich Apparent Sidereal Time (astronomy-engine's
// SiderealTime, in sidereal hours) shifted by the observer's longitude —
// each 15° of longitude is 1 sidereal hour. longitudeDeg=0 returns GAST
// itself. Extracted out of StarTrackerView.tsx so other real-time-clock
// surfaces (e.g. StarTrackerHero) can share the same real calculation
// instead of each hand-rolling their own.
export function localSiderealTime(now: Date, longitudeDeg: number): string {
  const gast = SiderealTime(now);
  const lst = (((gast + longitudeDeg / 15) % 24) + 24) % 24;
  const hours = Math.floor(lst);
  const minutes = Math.floor((lst - hours) * 60);
  const seconds = Math.floor(((lst - hours) * 60 - minutes) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
