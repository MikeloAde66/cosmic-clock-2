import Link from 'next/link';
import { Moon, Sun, Orbit } from 'lucide-react';
import SiteHeader from '@/components/astroSim/SiteHeader';
import ModeBadge, { type DataMode } from '@/components/astroSim/ModeBadge';

export const metadata = { title: 'Astro Simulator · Ai One' };

const MODES: { href: string; icon: typeof Moon; title: string; text: string; badge: DataMode; badgeNote: string }[] = [
  {
    href: '/astro-sim/moon',
    icon: Moon,
    title: 'Moon grid',
    text: 'A lunar globe with a tactical lat/lon grid and a targeting reticle. Sweep it over a named feature to lock on and read its size and depth.',
    badge: 'ENHANCED',
    badgeNote: 'ENHANCED with a bundled NASA map, SIM until then',
  },
  {
    href: '/astro-sim/sun',
    icon: Sun,
    title: 'Live Sun',
    text: 'The latest frames from NASA’s Solar Dynamics Observatory, switchable by lens filter: white light, 304Å, 171Å and more.',
    badge: 'LIVE',
    badgeNote: 'Latest images from sdo.gsfc.nasa.gov',
  },
  {
    href: '/astro-sim/probe',
    icon: Orbit,
    title: 'Probe drop',
    text: 'Fall through the atmosphere of Venus or Jupiter. Watch pressure, temperature, wind and hull integrity, and time your chute.',
    badge: 'SIM',
    badgeNote: 'A game: procedural physics, not mission data',
  },
];

// Astro Simulator landing page. Same pattern as /flight-school: a real route
// in this app that scrolls inside its own fixed layer (body is overflow:hidden).
export default function AstroSimPage() {
  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Astro Simulator" title="Ai One Virtual Observatory" />
      <main className="max-w-5xl px-4 pb-16 mx-auto">
        <section className="pt-12 pb-10 text-center sm:pt-16">
          <p className="text-xs tracking-[0.3em] text-cyan-400 uppercase">Virtual Observatory</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl text-balance">Star Tracker shows you where. This takes you there.</h1>
          <p className="max-w-xl mx-auto mt-3 text-sm leading-relaxed text-slate-400">
            Every view is labelled so you always know what you are looking at: a live instrument feed, real data we have
            processed, or a simulation.
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <ModeBadge mode="LIVE" />
            <ModeBadge mode="ENHANCED" />
            <ModeBadge mode="SIM" />
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {MODES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex flex-col p-5 transition border rounded-2xl border-slate-800 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-900/70"
            >
              <div className="flex items-center justify-between">
                <m.icon className="w-5 h-5 text-cyan-300" />
                <ModeBadge mode={m.badge} note={m.badgeNote} />
              </div>
              <h2 className="mt-4 text-sm font-bold text-white">{m.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{m.text}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
