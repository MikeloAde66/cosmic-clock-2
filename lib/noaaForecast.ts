// Geocoding + multi-day NWS forecast for the Gallery Grid Weather card's
// expanded overlay (see components/WeatherForecastOverlay.tsx).
//
// Deliberately not sharing code with lib/useWeatherLocation.ts (the
// existing footer inline-search + umbrella-icon hook): that hook is a
// multi-consumer piece of shared state (LeftNav, SiteFooter), and this
// card's overlay is a separate, self-contained interaction that shouldn't
// risk touching it. The NWS/geocode calls themselves are the same
// well-established pattern already proven in that hook and in
// NoaaWidget.tsx — a small amount of duplication, not a new approach.

const NWS_HEADERS = { 'User-Agent': '(CosmicClockApp, contact@cosmicclock.io)' };

export interface GeocodedLocation {
  label: string;
  lat: number;
  lon: number;
}

export interface ForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  isDaytime: boolean;
  shortForecast: string;
}

export interface NoaaForecastResult {
  location: GeocodedLocation;
  current: ForecastPeriod;
  // The next several day/night periods after "current" (NWS alternates
  // day/night, e.g. "Tuesday", "Tuesday Night", "Wednesday"...) — up to 6,
  // which covers roughly 3 days including both day and night entries.
  upcoming: ForecastPeriod[];
}

// Accepts a ZIP code, city name, or full address. countrycodes=us matters
// more here than it might look — a bare 5-digit ZIP with no country hint
// is genuinely ambiguous to Nominatim (verified live: "10001" alone
// resolved to a location in Algeria, not New York) and NWS only covers
// the US anyway, so there's no case where a non-US match would ever be
// useful downstream.
export async function geocodeLocation(query: string): Promise<GeocodedLocation> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  if (!data || data.length === 0) throw new Error('Location not found.');
  const { lat, lon, display_name } = data[0];
  // For a ZIP-code query, Nominatim's first display_name segment is
  // usually the ZIP itself right back (e.g. "10001, Manhattan, New York
  // County, New York, United States") — showing that back to someone who
  // just typed "10001" is a redundant, uninformative label. Skip a
  // purely-numeric first segment in favor of the next one, which is the
  // actual place name.
  const segments = display_name.split(',').map((s: string) => s.trim());
  const label = /^\d+$/.test(segments[0]) ? segments[1] ?? segments[0] : segments[0];
  return { label, lat: Number(lat), lon: Number(lon) };
}

export async function fetchNoaaForecast(location: GeocodedLocation): Promise<NoaaForecastResult> {
  const pointRes = await fetch(`https://api.weather.gov/points/${location.lat.toFixed(4)},${location.lon.toFixed(4)}`, {
    headers: NWS_HEADERS,
  });
  if (!pointRes.ok) throw new Error('No NWS coverage for this location (US only).');
  const pointData = await pointRes.json();

  const forecastRes = await fetch(pointData.properties.forecast, { headers: NWS_HEADERS });
  if (!forecastRes.ok) throw new Error('Forecast unavailable for this location.');
  const forecastData = await forecastRes.json();
  const periods: ForecastPeriod[] = forecastData.properties.periods.map((p: Record<string, unknown>) => ({
    name: p.name as string,
    temperature: p.temperature as number,
    temperatureUnit: p.temperatureUnit as string,
    isDaytime: p.isDaytime as boolean,
    shortForecast: p.shortForecast as string,
  }));

  const [current, ...rest] = periods;
  if (!current) throw new Error('No forecast periods returned.');

  return { location, current, upcoming: rest.slice(0, 6) };
}
