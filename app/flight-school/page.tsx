'use client';

import Link from 'next/link';
import { Home, GraduationCap, Gamepad2 } from 'lucide-react';

// Landing page between the dashboard's Flight School card and the two real
// things it now leads to — previously this path went straight to the
// Spectre-AI GCS simulator (now at /flight-school/simulator) via a
// next.config.ts rewrite. Ground School is intentionally a separate Next.js
// page (components/groundSchool), not bolted onto the simulator's own
// static HTML, so it can have real lessons, a quiz, and a live AI
// instructor rather than being squeezed into that opaque artifact file.
export default function FlightSchoolPage() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-screen gap-10 px-4 py-16 bg-[#07090E] text-slate-100">
      <Link
        href="/"
        aria-label="Home"
        className="absolute flex items-center gap-1.5 h-8 px-3 top-4 right-4 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
      >
        <Home className="w-3.5 h-3.5" />
        Home
      </Link>

      <div className="text-center">
        <p className="text-xs font-mono tracking-[0.3em] text-cyan-400 uppercase">Flight School</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Learn to fly, then prove it.</h1>
        <p className="max-w-xl mx-auto mt-3 text-sm text-slate-400">
          Start with Ground School if you&apos;re new to drones, or jump straight into the simulator if you already
          know your way around a transmitter.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <Link
          href="/ground-school"
          className="flex flex-col justify-between gap-4 p-6 text-left transition border rounded-2xl border-slate-800 bg-slate-900/40 hover:border-cyan-500/60 hover:bg-slate-900/70"
        >
          <div className="flex items-center justify-center border rounded-xl w-11 h-11 border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-white">Ground School</div>
            <p className="mt-1 text-xs text-slate-400">
              Terminology, flight modes, real FAA rules, a knowledge check, and a solo flight checkride — start here
              if you&apos;re learning to fly.
            </p>
          </div>
        </Link>

        <Link
          href="/flight-school/simulator"
          className="flex flex-col justify-between gap-4 p-6 text-left transition border rounded-2xl border-slate-800 bg-slate-900/40 hover:border-cyan-500/60 hover:bg-slate-900/70"
        >
          <div className="flex items-center justify-center border rounded-xl w-11 h-11 border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-white">Simulator</div>
            <p className="mt-1 text-xs text-slate-400">
              Spectre-AI GCS — the full flight sim with failsafe drills, AI object detection, and MAVLink telemetry.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
