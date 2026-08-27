'use client';

import React, { useEffect, useState } from 'react';
import { Apple, Music2, Smartphone } from 'lucide-react';
import { FORECAST_STREAM_MS } from '@/lib/useWeatherLocation';

function useLiveClock() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
      const month = now.toLocaleDateString('en-US', { month: 'short' });
      const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      setLabel(`${weekday} ${month} ${now.getDate()} ${time}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return label;
}

// Placeholder destinations — swap for the real profile URLs once they exist.
const SOCIAL_LINKS = [
  { name: 'Facebook', glyph: 'FB', href: 'https://facebook.com/your-page' },
  { name: 'Instagram', glyph: 'IG', href: 'https://instagram.com/your-handle' },
  { name: 'Reddit', glyph: 'r/', href: 'https://reddit.com/r/your-subreddit' },
  { name: 'TikTok', icon: Music2, href: 'https://tiktok.com/@your-handle' },
  { name: 'X', glyph: '𝕏', href: 'https://x.com/your-handle' },
  { name: 'YouTube', glyph: 'YT', href: 'https://youtube.com/@your-channel' },
];

interface SiteFooterProps {
  // Umbrella-icon-driven inline search + forecast stream — see
  // lib/useWeatherLocation.ts. All optional so SiteFooter still renders
  // fine without a weather hook wired in (e.g. isolated testing).
  weatherSearchOpen?: boolean;
  weatherLoading?: boolean;
  weatherError?: string | null;
  weatherForecastText?: string | null;
  weatherCurrentTemp?: { value: number; unit: string } | null;
  onWeatherSubmit?: (query: string) => void;
}

export default function SiteFooter({
  weatherSearchOpen,
  weatherLoading,
  weatherError,
  weatherForecastText,
  weatherCurrentTemp,
  onWeatherSubmit,
}: SiteFooterProps) {
  const clockLabel = useLiveClock();
  const [locationInput, setLocationInput] = useState('');

  const handleWeatherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationInput.trim()) return;
    onWeatherSubmit?.(locationInput);
    setLocationInput('');
  };

  return (
    <footer className="relative z-10 w-full shrink-0 bg-[#04060A] border-t border-slate-800/80 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">EARTH TIME</span>
          <span className="text-white font-bold bg-white/10 border border-neutral-700/30 px-2 py-0.5 rounded">
            {clockLabel || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">KALI YUGA</span>
          <span className="text-slate-100 font-medium">YEAR 5,128</span>
        </div>

        {/* Weather — inline in the footer's normal document flow (not an
            absolutely-positioned overlay/popup), per the standing "dedicated
            surfaces, no floating popups" rule. Three mutually exclusive
            states: the search input (umbrella click), the full forecast
            line (fades out on its own via CSS after FORECAST_STREAM_MS),
            then just the persistent temp once it's gone. */}
        {weatherSearchOpen && (
          <form onSubmit={handleWeatherSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="ZIP OR CITY, STATE"
              autoFocus
              className="w-40 px-2 py-1 text-[11px] bg-black/60 border border-slate-700 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-green-500/60"
            />
            <button
              type="submit"
              disabled={weatherLoading}
              className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {weatherLoading ? '…' : 'Go'}
            </button>
          </form>
        )}

        {!weatherSearchOpen && weatherError && (
          <span className="text-red-400">{weatherError}</span>
        )}

        {!weatherSearchOpen && !weatherError && weatherForecastText && (
          <span
            key={weatherForecastText}
            className="text-green-300 footer-forecast-fade"
            style={{ animationDuration: `${FORECAST_STREAM_MS}ms` }}
          >
            {weatherForecastText}
          </span>
        )}

        {!weatherSearchOpen && !weatherError && !weatherForecastText && weatherCurrentTemp && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            <span className="text-green-300 font-bold">
              {weatherCurrentTemp.value}°{weatherCurrentTemp.unit}
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes footerForecastFade {
          0%,
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .footer-forecast-fade {
          /* Duration is set via inline style on the element (see the span
             below), not interpolated here — styled-jsx's dynamic-value
             substitution silently produced animation-duration: 0s for an
             imported constant like FORECAST_STREAM_MS (as opposed to a
             local prop/state value), which made the animation jump straight
             to its "forwards"-filled end state (opacity: 0) with no visible
             fade at all. The 8s here is just a static fallback. */
          animation-name: footerForecastFade;
          animation-duration: 8s;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }
      `}</style>

      <div className="flex items-center gap-4 text-white">
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="transition-all duration-200 drop-shadow-[0_0_4px_rgba(255,255,255,0.45)] hover:scale-110 hover:drop-shadow-[0_0_9px_rgba(255,255,255,0.9)]"
          >
            {s.icon ? <s.icon size={16} /> : <span className="font-bold text-sm">{s.glyph}</span>}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded text-[10px] text-slate-300">
          <Apple size={12} /> App Store
        </button>
        <button className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded text-[10px] text-slate-300">
          <Smartphone size={12} /> Google Play
        </button>
      </div>
    </footer>
  );
}
