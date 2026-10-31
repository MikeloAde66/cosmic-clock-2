'use client';

import React, { useEffect, useState } from 'react';
import { Apple, Music2, Smartphone } from 'lucide-react';
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
// SoundCloud and ReverbNation use their real brand marks (same convention as
// SOCIALS' inline <path> icons) — fill="currentColor" so they pick up the
// row's white glow styling like the rest. SoundClick has no verified brand
// SVG on hand yet, so it keeps the lucide note placeholder until one is
// provided.
const SOCIAL_LINKS = [
  { name: 'SoundClick', Icon: Music2, href: 'https://soundclick.com/song/15361676' },
  {
    name: 'SoundCloud',
    href: 'https://soundcloud.com/discover',
    icon: (
      <path
        fill="currentColor"
        d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z"
      />
    ),
  },
  {
    name: 'ReverbNation',
    href: 'https://www.reverbnation.com/beatbrokers526',
    icon: (
      <path
        fill="currentColor"
        d="M24 9.324l-9.143-.03L11.971.57 9.143 9.294 0 9.324h.031l7.367 5.355-2.855 8.749h.029l7.459-5.386 7.396 5.386-2.855-8.73L24 9.315"
      />
    ),
  },
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

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-white lg:gap-x-4">
        {SOCIALS.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 lg:h-7 lg:w-7 text-slate-200 transition-all duration-200 hover:scale-110 hover:border-teal-300"
          >
            {s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.img} alt="" className="block h-5 w-auto lg:h-4" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden="true">
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
            className="grid h-9 w-9 place-items-center transition-all duration-200 drop-shadow-[0_0_4px_rgba(255,255,255,0.45)] lg:h-auto lg:w-auto hover:scale-110 hover:drop-shadow-[0_0_9px_rgba(255,255,255,0.9)]"
          >
            {s.icon ? (
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                {s.icon}
              </svg>
            ) : (
              s.Icon && <s.Icon size={18} />
            )}
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
