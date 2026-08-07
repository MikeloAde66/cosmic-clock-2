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

export default function NoaaWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showSatellite, setShowSatellite] = useState(false);
  const [loading, setLoading] = useState(true);

  // Address lookup / teletype readout state
  const [showLookup, setShowLookup] = useState(false);
  const [address, setAddress] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [forecastText, setForecastText] = useState("");
  const [typedOutput, setTypedOutput] = useState("");

  useEffect(() => {
    // Default coordinates (Charleston, SC)
    const lat = 32.7765;
    const lon = -79.9311;

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
  }, []);

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
      <div className="w-full p-3 border rounded-lg border-slate-800 bg-slate-950/80">
        <button
          onClick={() => { setShowSatellite(!showSatellite); setShowLookup(false); }}
          className="w-full text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/80">
              NOAA GROUND TELEMETRY
            </span>
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-amber-400">
              {showSatellite ? "CLOSE SAT" : "CLICK FOR SATELLITE"}
            </span>
          </div>

          {loading ? (
            <p className="mt-2 font-mono text-xs text-slate-500">Syncing NOAA satellite...</p>
          ) : weather ? (
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <div className="text-lg font-bold text-slate-100">
                  {weather.temp}°{weather.unit}
                </div>
                <p className="text-xs leading-tight text-slate-400">
                  {weather.shortForecast}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-block w-2 h-2 rounded-full ${weather.isDaytime ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]'}`} />
                <span className="text-[10px] font-mono text-slate-500 block mt-1">
                  {weather.isDaytime ? "SOLAR DAY" : "NIGHT OBS"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 font-mono text-xs text-slate-500">Telemetry Offline</p>
          )}
        </button>

        {/* Address Lookup Toggle */}
        <div className="pt-2 mt-2 border-t border-slate-900">
          <button
            onClick={() => { setShowLookup(!showLookup); setShowSatellite(false); }}
            className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-amber-400 transition-colors"
          >
            <Search className="w-3 h-3" />
            {showLookup ? "CLOSE LOOKUP" : "LOOKUP LOCATION"}
          </button>

          {showLookup && (
            <div className="mt-2 space-y-2">
              <form onSubmit={handleLookup} className="flex gap-1.5">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ADDRESS OR CITY..."
                  className="flex-1 min-w-0 px-2 py-1.5 text-[11px] font-mono bg-black/60 border border-slate-800 rounded text-amber-300 placeholder-slate-600 outline-none focus:border-amber-500/60"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap"
                >
                  {lookupLoading ? "…" : "Go"}
                </button>
              </form>

              {lookupError && (
                <p className="text-[10px] font-mono text-red-400">{lookupError}</p>
              )}

              {typedOutput && (
                <div className="p-2 border rounded bg-black/70 border-slate-900 max-h-32 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300">
                    {typedOutput}
                    {typedOutput.length < forecastText.length && (
                      <span className="text-amber-500 animate-pulse">▋</span>
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Night / Satellite Overlay Modal */}
      {showSatellite && (
        <div className="p-2 mt-2 border rounded-lg shadow-2xl border-slate-800 bg-slate-900/90">
          <div className="text-[10px] font-mono text-amber-500 mb-1">
            GOES-EAST GEOCOLOR INFRARED SKY FEED
          </div>
          <div className="relative overflow-hidden bg-black border rounded aspect-video border-slate-800">
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
