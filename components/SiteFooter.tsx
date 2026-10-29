'use client';

import React, { useEffect, useState } from 'react';
import { Apple, Music2, Music3, Music4, Smartphone } from 'lucide-react';
import { FORECAST_STREAM_MS } from '@/lib/useWeatherLocation';
import { SOCIALS } from '@/components/signal/SocialRow';

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

// The real music profiles. The main social logos (Instagram, YouTube, TikTok,
// Facebook, Reddit, Tumblr, LinkedIn) come from the shared SOCIALS list so this
// footer matches the Signal page.
const SOCIAL_LINKS = [
  { name: 'SoundClick', icon: Music2, href: 'https://soundclick.com/song/15361676' },
  { name: 'SoundCloud', icon: Music4, href: 'https://soundcloud.com/michael-bradley-307688752' },
  { name: 'ReverbNation', icon: Music3, href: 'https://reverbnation.com/beatbrokers526' },
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
        {SOCIALS.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-slate-200 transition-all duration-200 hover:scale-110 hover:border-teal-300"
          >
            {s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.img} alt="" className="block h-4 w-auto" />
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                {s.icon}
              </svg>
            )}
          </a>
        ))}
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="transition-all duration-200 drop-shadow-[0_0_4px_rgba(255,255,255,0.45)] hover:scale-110 hover:drop-shadow-[0_0_9px_rgba(255,255,255,0.9)]"
          >
            <s.icon size={16} />
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
