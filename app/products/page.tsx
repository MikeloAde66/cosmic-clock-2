'use client';

import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import Starfield from '@/components/Starfield';

// Was a flip-page carousel browsing several hardware placeholders plus a
// Star Tracker PRO teaser — Star Tracker now has its own direct dashboard
// card and nav-independent sales page, and the hardware placeholders were
// retired, so this route is just the one real thing left for it: BeatBrokerz
// (Nicole Cross's SoundClick page), matching the dashboard card of the same
// name. Nothing currently links here (the dashboard card and LeftNav both
// go straight to SoundClick/Billing respectively) — this exists so a direct
// or bookmarked /products hit still lands somewhere coherent instead of 404ing.
export default function ProductsPage() {
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <Link
        href="/"
        aria-label="Home"
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
      >
        <Home className="w-3.5 h-3.5" />
        Home
      </Link>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">BeatBrokerz</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Gospel &amp; acoustic guitar music</h1>
          <p className="mt-2 text-sm text-neutral-400">Stream the full catalog on SoundClick.</p>
        </div>
        <a
          href="https://nicolecross.soundclick.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-3 text-sm font-semibold text-black transition bg-white rounded-lg hover:bg-neutral-200"
        >
          Open on SoundClick
        </a>
      </div>
    </div>
  );
}
