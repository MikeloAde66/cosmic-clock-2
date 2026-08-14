"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Search } from "lucide-react";

interface WeatherData {
  temp: number;
  unit: string;
  shortForecast: string;
  isDaytime: boolean;
}

interface NoaaWidgetProps {
  // Real coordinates from the browser's Geolocation API (see
  // lib/useGeolocation.ts), passed down from CosmicCanvas's globe marker.
  // Falls back to Charleston, SC when geolocation was denied/unavailable
  // or just hasn't resolved yet.
  initialCoords?: { lat: number; lon: number } | null;
}

export default function NoaaWidget({ initialCoords }: NoaaWidgetProps = {}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  // Opens straight to the satellite feed — this view is reached via its own
  // dedicated "Weather" button already, so a second click just to reveal
  // the image it's named after was redundant. Still toggleable via "CLOSE
  // SAT" for anyone who wants the compact readout alone.
  const [showSatellite, setShowSatellite] = useState(true);
  const [loading, setLoading] = useState(true);

  // Address lookup / teletype readout state
  const [showLookup, setShowLookup] = useState(false);
  const [address, setAddress] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [forecastText, setForecastText] = useState("");
  const [typedOutput, setTypedOutput] = useState("");

  useEffect(() => {
    // Real geolocated coordinates when available; Charleston, SC otherwise
    // (denied permission, unsupported browser, or not resolved yet). This
    // effect re-runs once initialCoords actually arrives, so a widget that
    // mounted before geolocation resolved still upgrades to the real fix
    // rather than being stuck on the fallback for the rest of the session.
    const lat = initialCoords?.lat ?? 32.7765;
    const lon = initialCoords?.lon ?? -79.9311;
    queueMicrotask(() => setLoading(true));

    async function fetchNoaaData() {
      try {
        // Step 1: Get Grid Point from NOAA API
        const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
          headers: { "User-Agent": "(CosmicClockApp, contact@cosmicclock.io)" }
        });
        const pointData = await pointRes.json();

        // Step 2: Fetch Hourly Forecast
        const forecastUrl = pointData.properties.forecastHourly;
        const forecastRes = await fetch(forecastUrl, {
          headers: { "User-Agent": "(CosmicClockApp, contact@cosmicclock.io)" }
        });
        const forecastData = await forecastRes.json();
        const currentPeriod = forecastData.properties.periods[0];

        setWeather({
          temp: currentPeriod.temperature,
          unit: currentPeriod.temperatureUnit,
          shortForecast: currentPeriod.shortForecast,
          isDaytime: currentPeriod.isDaytime
        });
      } catch (err) {
        console.error("NOAA Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchNoaaData();
  }, [initialCoords]);

  // Teletype typewriter effect for the lookup readout
  useEffect(() => {
    if (!forecastText) return;
    setTypedOutput("");
    let i = 0;
    // Recompute the full slice each tick (rather than appending onto previous
    // state) so this self-corrects if the effect ever fires more than once.
    const interval = setInterval(() => {
      i++;
      setTypedOutput(forecastText.slice(0, i));
      if (i >= forecastText.length) {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [forecastText]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    setLookupLoading(true);
    setLookupError("");
    setForecastText("");
    setTypedOutput("");

    try {
      // Step 1: Geocode the address via OpenStreetMap Nominatim
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
      );
      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        setLookupError("LOCATION NOT FOUND.");
        return;
      }

      const { lat, lon, display_name } = geoData[0];

      // Step 2: Resolve the NWS grid point for these coordinates
      const pointRes = await fetch(
        `https://api.weather.gov/points/${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`,
        { headers: { "User-Agent": "(CosmicClockApp, contact@cosmicclock.io)" } }
      );
      if (!pointRes.ok) {
        // The National Weather Service only covers US locations/territories
        setLookupError("NO NWS COVERAGE FOR THIS LOCATION (US ONLY).");
        return;
      }
      const pointData = await pointRes.json();

      // Step 3: Fetch the detailed forecast
      const forecastRes = await fetch(pointData.properties.forecast, {
        headers: { "User-Agent": "(CosmicClockApp, contact@cosmicclock.io)" }
      });
      const forecastData = await forecastRes.json();
      const period = forecastData.properties.periods[0];
      const shortName = display_name.split(",")[0];

      setForecastText(
        `LOCATION: ${shortName.toUpperCase()}\n` +
        `PERIOD: ${period.name.toUpperCase()}\n` +
        `TEMP: ${period.temperature}°${period.temperatureUnit}\n` +
        `WIND: ${period.windSpeed} ${period.windDirection}\n\n` +
        `${period.detailedForecast}`
      );
    } catch {
      setLookupError("TELEMETRY OFFLINE. CONNECTION FAILED.");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Primary Widget Container */}
      <div className="w-full p-5 border rounded-xl border-slate-800 bg-slate-950/80">
        <button
          onClick={() => { setShowSatellite(!showSatellite); setShowLookup(false); }}
          className="w-full text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-white/70">
              NOAA GROUND TELEMETRY
            </span>
            <span className="text-xs font-mono text-slate-500 group-hover:text-white">
              {showSatellite ? "CLOSE SAT" : "CLICK FOR SATELLITE"}
            </span>
          </div>

          {loading ? (
            <p className="mt-3 font-mono text-sm text-slate-500">Syncing NOAA satellite...</p>
          ) : weather ? (
            <div className="flex items-baseline justify-between mt-3">
              <div>
                <div className="text-3xl font-bold text-slate-100">
                  {weather.temp}°{weather.unit}
                </div>
                <p className="text-sm leading-tight text-slate-400 mt-1">
                  {weather.shortForecast}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${weather.isDaytime ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]'}`} />
                <span className="text-xs font-mono text-slate-500 block mt-1">
                  {weather.isDaytime ? "SOLAR DAY" : "NIGHT OBS"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 font-mono text-sm text-slate-500">Telemetry Offline</p>
          )}
        </button>

        {/* Address Lookup Toggle */}
        <div className="pt-3 mt-3 border-t border-slate-900">
          <button
            onClick={() => { setShowLookup(!showLookup); setShowSatellite(false); }}
            className="flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            {showLookup ? "CLOSE LOOKUP" : "LOOKUP LOCATION"}
          </button>

          {showLookup && (
            <div className="mt-3 space-y-2">
              <form onSubmit={handleLookup} className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ADDRESS OR CITY..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-black/60 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/50"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-3 py-2 text-xs font-mono font-bold uppercase rounded bg-white text-black hover:bg-neutral-200 disabled:opacity-50 whitespace-nowrap"
                >
                  {lookupLoading ? "…" : "Go"}
                </button>
              </form>

              {lookupError && (
                <p className="text-xs font-mono text-red-400">{lookupError}</p>
              )}

              {typedOutput && (
                <div className="p-3 border rounded bg-black/70 border-slate-900 max-h-40 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">
                    {typedOutput}
                    {typedOutput.length < forecastText.length && (
                      <span className="text-white animate-pulse">▋</span>
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Satellite feed — opens by default now (see showSatellite above),
          sized to the same width as the widget above it rather than a
          small fixed aspect box, so it reads comfortably at the view's new
          larger scale without sprawling edge-to-edge. */}
      {showSatellite && (
        <div className="p-3 mt-3 border rounded-xl shadow-2xl border-slate-800 bg-slate-900/90">
          <div className="text-xs font-mono text-white mb-2">
            GOES-EAST GEOCOLOR INFRARED SKY FEED
          </div>
          <div className="relative overflow-hidden bg-black border rounded-lg aspect-video border-slate-800">
            <Image
              src="https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/1250x750.jpg"
              alt="NOAA GOES Realtime Satellite Sky Conditions"
              fill
              unoptimized
              className="object-cover opacity-90"
            />
          </div>
        </div>
      )}
    </div>
  );
}
