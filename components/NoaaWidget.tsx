"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

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

  return (
    <div className="relative">
      {/* Primary Widget Container */}
      <button
        onClick={() => setShowSatellite(!showSatellite)}
        className="w-full p-3 text-left transition-all border rounded-lg cursor-pointer border-slate-800 bg-slate-950/80 hover:border-amber-500/40 group"
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