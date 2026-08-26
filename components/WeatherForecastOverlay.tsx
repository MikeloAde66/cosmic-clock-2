'use client';

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { geocodeLocation, fetchNoaaForecast, type NoaaForecastResult } from '@/lib/noaaForecast';

const NOAA_SATELLITE_URL = 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/1250x750.jpg';

interface WeatherForecastOverlayProps {
  onClose: () => void;
}

// Opened from the Gallery Grid's Weather card — a self-contained
// address/ZIP/city lookup against the real NWS API, expanding to a
// current-conditions + multi-day mini-forecast panel, with the same live
// GOES-16 feed the card's own passive preview uses staying visible as the
// panel's header the whole time (not swapped out once results load).
export default function WeatherForecastOverlay({ onClose }: WeatherForecastOverlayProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<NoaaForecastResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const location = await geocodeLocation(query);
      const forecast = await fetchNoaaForecast(location);
      setResult(forecast);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Telemetry offline.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden border rounded-2xl border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Live satellite header — stays put through loading/results/error,
            same feed the card's own passive preview uses. */}
        <div className="relative w-full h-28 overflow-hidden bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NOAA_SATELLITE_URL} alt="" className="object-cover w-full h-full opacity-80" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute flex items-center justify-center w-7 h-7 text-white rounded-full top-2 right-2 bg-black/60 hover:bg-black/80"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="absolute px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-white rounded bottom-2 left-2 bg-black/60">
            GOES-16 GeoColor
          </span>
        </div>

        <div className="p-5">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ZIP, city, or address..."
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/40"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center justify-center w-10 h-10 text-black bg-white rounded hover:bg-neutral-200 disabled:opacity-40 shrink-0"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {loading && <p className="font-mono text-sm text-slate-500">Syncing NOAA satellite…</p>}
          {error && <p className="font-mono text-sm text-red-400">{error}</p>}

          {result && (
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">{result.location.label}</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-4xl font-bold text-white">
                  {result.current.temperature}°{result.current.temperatureUnit}
                </span>
                <span className="text-sm text-slate-400">{result.current.shortForecast}</span>
              </div>

              {result.upcoming.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-800">
                  {result.upcoming.slice(0, 6).map((p, i) => (
                    <div key={i} className="p-2 text-center rounded-lg bg-slate-900/60">
                      <p className="text-[10px] font-mono uppercase text-slate-500 truncate">{p.name}</p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {p.temperature}°{p.temperatureUnit}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{p.shortForecast}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
