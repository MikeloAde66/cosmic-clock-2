'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SavedLocation {
  label: string;
  lat: number;
  lon: number;
}

interface CurrentTemp {
  value: number;
  unit: string;
}

const STORAGE_KEY = 'aione_weather_location_v1';
// How long the full forecast line stays up before fading to just the
// persistent temp readout — see the footerForecastFade keyframes in
// SiteFooter.tsx, whose animation-duration is kept in lockstep with this.
export const FORECAST_STREAM_MS = 8000;

const NWS_HEADERS = { 'User-Agent': '(CosmicClockApp, contact@cosmicclock.io)' };

async function geocode(query: string): Promise<SavedLocation> {
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  );
  const geoData = await geoRes.json();
  if (!geoData || geoData.length === 0) throw new Error('Location not found.');
  const { lat, lon, display_name } = geoData[0];
  return { label: display_name.split(',')[0], lat: Number(lat), lon: Number(lon) };
}

async function fetchForecast(lat: number, lon: number, label: string) {
  const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: NWS_HEADERS,
  });
  if (!pointRes.ok) throw new Error('No NWS coverage for this location (US only).');
  const pointData = await pointRes.json();
  const forecastRes = await fetch(pointData.properties.forecast, { headers: NWS_HEADERS });
  const forecastData = await forecastRes.json();
  const period = forecastData.properties.periods[0];

  // period.temperature is the forecast period's daytime high / overnight
  // low, not a live reading — the real current temperature comes from the
  // nearest station's latest actual observation, a completely separate
  // endpoint. properties.value there is always Celsius regardless of the
  // point/forecast endpoints' own units, hence the explicit conversion.
  const stationsRes = await fetch(pointData.properties.observationStations, { headers: NWS_HEADERS });
  const stationsData = await stationsRes.json();
  const stationUrl = stationsData.features?.[0]?.id;
  if (!stationUrl) throw new Error('No observation station found for this location.');
  const obsRes = await fetch(`${stationUrl}/observations/latest`, { headers: NWS_HEADERS });
  const obsData = await obsRes.json();
  const celsius = obsData.properties?.temperature?.value;
  if (celsius == null) throw new Error('Current observation unavailable for this station.');
  const fahrenheit = Math.round((celsius * 9) / 5 + 32);

  return {
    forecastText: `${label.toUpperCase()} — CURRENTLY ${fahrenheit}°F, ${period.name.toUpperCase()}: ${period.shortForecast}`,
    temp: { value: fahrenheit, unit: 'F' } as CurrentTemp,
  };
}

// Drives the umbrella icon's inline search + footer forecast stream. Kept
// separate from NoaaWidget (still mounted-but-hidden elsewhere for its own
// ambient geolocated fetch) since that's a different, heavier UI built for
// the old standalone Weather view — this is the lightweight, persistent-
// chrome version per the "no popup, inline in the footer" redesign.
export function useWeatherLocation() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecastText, setForecastText] = useState<string | null>(null);
  const [currentTemp, setCurrentTemp] = useState<CurrentTemp | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const showResult = useCallback((text: string, temp: CurrentTemp) => {
    setForecastText(text);
    setCurrentTemp(temp);
    setError(null);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => setForecastText(null), FORECAST_STREAM_MS);
  }, []);

  const submitLocation = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const loc = await geocode(query);
        const { forecastText: text, temp } = await fetchForecast(loc.lat, loc.lon, loc.label);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        showResult(text, temp);
        setSearchOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Telemetry offline.');
      } finally {
        setLoading(false);
      }
    },
    [showResult]
  );

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
    setError(null);
  }, []);

  // Double-click quick-view — uses the saved lat/lon directly (no re-geocode)
  // if a location was searched before; opens the search input instead if
  // there's nothing saved yet.
  const quickView = useCallback(async () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setSearchOpen(true);
      return;
    }
    setSearchOpen(false);
    setLoading(true);
    setError(null);
    try {
      const saved = JSON.parse(raw) as SavedLocation;
      const { forecastText: text, temp } = await fetchForecast(saved.lat, saved.lon, saved.label);
      showResult(text, temp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Telemetry offline.');
    } finally {
      setLoading(false);
    }
  }, [showResult]);

  return {
    searchOpen,
    loading,
    error,
    forecastText,
    currentTemp,
    weatherActive: !!currentTemp,
    toggleSearch,
    submitLocation,
    quickView,
  };
}
