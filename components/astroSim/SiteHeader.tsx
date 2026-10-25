import Link from 'next/link';
import { Home, Orbit } from 'lucide-react';
import ModeBadge, { type DataMode } from './ModeBadge';

// Same header treatment as Flight School: tiny tracked eyebrow, bold title,
// a Home pill on the right. Here the right side also carries the data badge.
export default function SiteHeader({
  eyebrow,
  title,
  mode,
  modeNote,
  sub,
}: {
  eyebrow: string;
  title: string;
  mode?: DataMode;
  modeNote?: string;
  /** Sub-pages get a link back to the observatory landing page. */
  sub?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#07090E]/90 backdrop-blur">
      <div className="flex items-center justify-between max-w-5xl gap-4 px-4 py-3 mx-auto">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.3em] text-cyan-400 uppercase">{eyebrow}</p>
          <p className="text-sm font-bold text-white truncate">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          {mode && <ModeBadge mode={mode} note={modeNote} />}
          {sub && (
            <Link
              href="/astro-sim"
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
            >
              <Orbit className="w-3.5 h-3.5" />
              Observatory
            </Link>
          )}
          <Link
            href="/"
            aria-label="Home"
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>
      </div>
    </header>
  );
}
