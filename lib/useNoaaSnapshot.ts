'use client';

import { useEffect, useState } from 'react';
import { useGeolocation } from './useGeolocation';

const NWS_HEADERS = { 'User-Agent': '(CosmicClockApp, contact@cosmicclock.io)' };
// Charleston, SC — the same fallback NoaaWidget already uses when
// geolocation is denied/unavailable, so this still shows a real live
// reading rather than nothing.
const FALLBACK_COORDS = { lat: 32.7765, lon: -79.9311 };

export interface NoaaSnapshot {
  temp: number | null;
  unit: string;
  loading: boolean;
}

// A lightweight sibling to NoaaWidget's own fetch — same NWS
// points -> forecastHourly pattern proven there, just returning a bare
// {temp, unit} pair instead of a full panel, for the Gallery Grid Weather
// card's live preview. Deliberately not sharing code with NoaaWidget
// itself: that component is mounted elsewhere (hidden, inside
// CosmicCanvas) for an unrelated reason, and isn't worth the coupling risk
// for what's a handful of duplicated lines.
export function useNoaaSnapshot(): NoaaSnapshot {
  const { status, coords } = useGeolocation();
  const [temp, setTemp] = useState<number | null>(null);
  const [unit, setUnit] = useState('F');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'pending') return; // wait for a real answer either way
    const { lat, lon } = coords ?? FALLBACK_COORDS;
    let cancelled = false;

    async function run() {
      try {
        const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
          headers: NWS_HEADERS,
        });
        const pointData = await pointRes.json();
        const forecastRes = await fetch(pointData.properties.forecastHourly, { headers: NWS_HEADERS });
        const forecastData = await forecastRes.json();
        const period = forecastData.properties.periods[0];
        if (!cancelled) {
          setTemp(period.temperature);
          setUnit(period.temperatureUnit);
        }
      } catch {
        // Leave temp null — the card just falls back to the satellite
        // image alone, no error state needed for a passive preview.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [status, coords]);

  return { temp, unit, loading };
}
