'use client';

import React from 'react';
import Link from 'next/link';
import { Radio as RadioIcon, Mic, LayoutGrid, Umbrella, Sparkles, Gift, ArrowUpRight } from 'lucide-react';
import { useDonation } from '@/lib/useDonation';

interface GalleryGridProps {
  onOpenRadio: () => void;
  onOpenPods: () => void;
  onOpenKali: () => void;
  onWeatherClick: () => void;
  weatherActive?: boolean;
}

interface CardDef {
  key: string;
  label: string;
  description: string;
  Icon: typeof RadioIcon;
  active?: boolean;
}

// Layout 2 (Gallery Grid) — a dashboard-style entry point into the app's
// real sections, not fabricated placeholder content. Radio/Pods/Kali land
// you in the dedicated Classic Hub view for that section (this is a
// launcher, not a place to cram full players/chat into tiny tiles);
// Products is a real separate route; Weather and Donate are direct actions
// (Weather has no standalone view at all — see lib/useWeatherLocation.ts —
// so its card just opens the same inline footer search the umbrella icon
// does, without leaving Gallery mode).
export default function GalleryGrid({ onOpenRadio, onOpenPods, onOpenKali, onWeatherClick, weatherActive }: GalleryGridProps) {
  const { loading: donateLoading, error: donateError, donate } = useDonation();

  const cardClass =
    'group relative flex flex-col justify-between p-5 text-left border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md hover:border-slate-600 hover:bg-slate-900/60 transition-all min-h-[140px]';

  const CardHeader = ({ Icon, active }: { Icon: typeof RadioIcon; active?: boolean }) => (
    <div className="flex items-start justify-between">
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-lg border ${
          active ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-slate-700 text-slate-300 bg-slate-950/60'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <ArrowUpRight className="w-4 h-4 transition-opacity opacity-0 text-slate-500 group-hover:opacity-100" />
    </div>
  );

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center gap-2 px-4 pt-14 pb-10 text-center">
        <h1
          className="text-4xl text-white md:text-5xl"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            textShadow: '0 2px 24px rgba(0,0,0,0.6), 0 0 40px rgba(96,165,250,0.25)',
          }}
        >
          Ai One
        </h1>
        <p className="font-mono text-xs tracking-widest uppercase text-slate-400">Cosmic Creation &amp; Broadcast Hub</p>
      </div>

      {/* 6-card grid */}
      <div className="grid max-w-5xl grid-cols-1 gap-4 px-4 pb-14 mx-auto sm:grid-cols-2 lg:grid-cols-3">
        <button onClick={onOpenRadio} className={cardClass}>
          <CardHeader Icon={RadioIcon} />
          <div className="mt-4">
            <div className="text-sm font-bold text-white">Radio</div>
            <p className="mt-1 text-xs text-slate-400">Live streaming stations, curated ambient/cosmic channels.</p>
          </div>
        </button>

        <button onClick={onOpenPods} className={cardClass}>
          <CardHeader Icon={Mic} />
          <div className="mt-4">
            <div className="text-sm font-bold text-white">Pods Studio</div>
            <p className="mt-1 text-xs text-slate-400">Your track library, uploads, and playlists.</p>
          </div>
        </button>

        <Link href="/products" className={cardClass}>
          <CardHeader Icon={LayoutGrid} />
          <div className="mt-4">
            <div className="text-sm font-bold text-white">Products</div>
            <p className="mt-1 text-xs text-slate-400">Hardware and kits — browse the full catalog.</p>
          </div>
        </Link>

        <button onClick={onWeatherClick} className={cardClass}>
          <CardHeader Icon={Umbrella} active={weatherActive} />
          <div className="mt-4">
            <div className="text-sm font-bold text-white">Weather</div>
            <p className="mt-1 text-xs text-slate-400">
              {weatherActive ? 'Forecast active — see the footer.' : 'Search a ZIP or city for a live forecast.'}
            </p>
          </div>
        </button>

        <button onClick={onOpenKali} className={cardClass}>
          <CardHeader Icon={Sparkles} />
          <div className="mt-4">
            <div className="text-sm font-bold text-white">Kali</div>
            <p className="mt-1 text-xs text-slate-400">Ancient technology, quantum physics, epoch cycles.</p>
          </div>
        </button>

        <button onClick={donate} disabled={donateLoading} className={`${cardClass} disabled:opacity-60`}>
          <CardHeader Icon={Gift} />
          <div className="mt-4">
            <div className="text-sm font-bold text-white">Donate</div>
            <p className="mt-1 text-xs text-slate-400">
              {donateError || (donateLoading ? 'Opening checkout…' : 'Support the project — $5 test donation.')}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
