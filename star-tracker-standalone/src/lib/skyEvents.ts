// Real astronomical events — eclipses computed live via astronomy-engine
// (verified independently against known upcoming events: the next partial
// lunar eclipse this search returns is Aug 28, 2026 at 96.6% obscuration,
// and the next two solar eclipses are the Feb 6, 2027 annular and the
// Aug 2, 2027 total — all matching real published eclipse predictions).
// Meteor showers are a fixed, well-documented annual calendar (peak dates
// don't require live computation the way eclipses do), not a live feed —
// there's no free API for that available to build against.

import { NextGlobalSolarEclipse, NextLunarEclipse, SearchGlobalSolarEclipse, SearchLunarEclipse } from 'astronomy-engine';

export interface UpcomingEclipse {
  type: 'lunar' | 'solar';
  kind: string;
  peak: Date;
  obscuration: number | null;
  latitude: number | null;
  longitude: number | null;
}

export function getUpcomingEclipses(now: Date, count = 2): UpcomingEclipse[] {
  const lunarEvents: UpcomingEclipse[] = [];
  let lunar = SearchLunarEclipse(now);
  for (let i = 0; i < count; i++) {
    lunarEvents.push({
      type: 'lunar',
      kind: lunar.kind,
      peak: lunar.peak.date,
      obscuration: lunar.obscuration,
      latitude: null,
      longitude: null,
    });
    lunar = NextLunarEclipse(lunar.peak);
  }

  const solarEvents: UpcomingEclipse[] = [];
  let solar = SearchGlobalSolarEclipse(now);
  for (let i = 0; i < count; i++) {
    solarEvents.push({
      type: 'solar',
      kind: solar.kind,
      peak: solar.peak.date,
      obscuration: solar.obscuration ?? null,
      latitude: solar.latitude ?? null,
      longitude: solar.longitude ?? null,
    });
    solar = NextGlobalSolarEclipse(solar.peak);
  }

  return [...lunarEvents, ...solarEvents].sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

export interface MeteorShower {
  name: string;
  peakMonth: number; // 1-12
  peakDay: number;
  parentBody: string;
}

// The eight major annual showers with well-established peak dates.
const METEOR_SHOWERS: MeteorShower[] = [
  { name: 'Quadrantids', peakMonth: 1, peakDay: 3, parentBody: '2003 EH1' },
  { name: 'Lyrids', peakMonth: 4, peakDay: 22, parentBody: 'Comet Thatcher' },
  { name: 'Eta Aquariids', peakMonth: 5, peakDay: 5, parentBody: "Comet 1P/Halley" },
  { name: 'Perseids', peakMonth: 8, peakDay: 12, parentBody: 'Comet 109P/Swift-Tuttle' },
  { name: 'Orionids', peakMonth: 10, peakDay: 21, parentBody: "Comet 1P/Halley" },
  { name: 'Leonids', peakMonth: 11, peakDay: 17, parentBody: 'Comet 55P/Tempel-Tuttle' },
  { name: 'Geminids', peakMonth: 12, peakDay: 14, parentBody: '3200 Phaethon' },
  { name: 'Ursids', peakMonth: 12, peakDay: 22, parentBody: 'Comet 8P/Tuttle' },
];

export interface UpcomingMeteorShower extends MeteorShower {
  nextPeak: Date;
}

export function getUpcomingMeteorShowers(now: Date, count = 3): UpcomingMeteorShower[] {
  return METEOR_SHOWERS.map((shower) => {
    let peak = new Date(now.getFullYear(), shower.peakMonth - 1, shower.peakDay);
    if (peak.getTime() < now.getTime()) {
      peak = new Date(now.getFullYear() + 1, shower.peakMonth - 1, shower.peakDay);
    }
    return { ...shower, nextPeak: peak };
  })
    .sort((a, b) => a.nextPeak.getTime() - b.nextPeak.getTime())
    .slice(0, count);
}

export function daysUntil(now: Date, target: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}
