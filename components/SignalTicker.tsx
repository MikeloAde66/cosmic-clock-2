'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from 'react';
import { tickerLines } from '@/lib/signal/ticker';
import { signalBody } from '@/components/signal/fonts';
import FooterSmoke from '@/components/FooterSmoke';

// A slim strip on the hub that types out Signal's tagline and dispatches, one
// line at a time, slowly enough to read. Tapping it opens the Signal page. It
// holds still while hovered or focused, and shows plain rotating text for
// anyone who prefers reduced motion.

const TYPE_MS = 45; // per character
const HOLD_MS = 3400; // a finished line stays readable this long
const REDUCED_MS = 8000;

const query = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const snapshotReduced = () => window.matchMedia(query).matches;
const serverReduced = () => false;

interface State {
  line: number;
  shown: number;
}
type Action = { type: 'tick'; length: number; count: number } | { type: 'next'; count: number } | { type: 'complete'; length: number };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'tick':
      return s.shown < a.length ? { ...s, shown: s.shown + 1 } : { line: (s.line + 1) % a.count, shown: 0 };
    case 'next':
      return { line: (s.line + 1) % a.count, shown: 0 };
    case 'complete':
      return { ...s, shown: a.length };
  }
}

export default function SignalTicker() {
  const lines = useMemo(() => tickerLines(), []);
  const reduced = useSyncExternalStore(subscribeReduced, snapshotReduced, serverReduced);
  const [paused, setPaused] = useState(false);
  const [state, dispatch] = useReducer(reducer, { line: 0, shown: 0 });
  const full = lines[state.line];

  useEffect(() => {
    if (paused) return;
    const id = reduced
      ? window.setTimeout(() => dispatch({ type: 'next', count: lines.length }), REDUCED_MS)
      : window.setTimeout(() => dispatch({ type: 'tick', length: full.length, count: lines.length }), state.shown < full.length ? TYPE_MS : HOLD_MS);
    return () => window.clearTimeout(id);
  }, [state, paused, reduced, full, lines.length]);

  const typed = reduced || paused ? full : full.slice(0, state.shown);
  const hold = () => setPaused(true);
  const release = () => {
    setPaused(false);
    dispatch({ type: 'complete', length: full.length });
  };

  return (
    <div className={`${signalBody.variable} relative z-10 w-full px-4 pt-2 pb-3 shrink-0`}>
      <FooterSmoke />
      <Link
        href="/signal"
        aria-label="Signal, the digital magazine. Open the dispatches."
        onMouseEnter={hold}
        onMouseLeave={release}
        onFocus={hold}
        onBlur={release}
        className="relative flex items-center max-w-5xl gap-3 px-3 py-2 mx-auto transition-colors border rounded-lg group border-slate-800/80 bg-[#0a0f16] hover:border-teal-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
      >
        <span className="flex items-center gap-2 shrink-0">
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 shrink-0"
            style={{ background: 'conic-gradient(from 210deg, #3fd0c9, #e3a53e, #3fd0c9)', clipPath: 'polygon(50% 6%, 95% 92%, 5% 92%)' }}
          />
          <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-teal-300">SIGNAL</span>
          <span className="hidden sm:inline font-mono text-[9px] tracking-[0.14em] text-amber-300/90 border border-amber-400/30 bg-amber-400/10 rounded px-1.5 py-0.5">SAMPLE ISSUE</span>
        </span>

        {/* the ghost copy reserves the finished line's height, so nothing jumps while it types */}
        <span className="relative grid flex-1 min-w-0 min-h-[22px] items-center" style={{ fontFamily: 'var(--font-signal-body), Georgia, serif' }}>
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 text-[14px] leading-snug">{full}</span>
          <span className="col-start-1 row-start-1 text-[14px] leading-snug text-slate-200">
            {typed}
            <span aria-hidden="true" className="inline-block w-[2px] h-[1em] ml-0.5 align-[-0.15em] bg-teal-300 animate-pulse" />
          </span>
        </span>

        <span className="hidden md:inline font-mono text-[10px] tracking-[0.14em] text-slate-500 transition-colors shrink-0 group-hover:text-teal-300">READ &rarr;</span>
      </Link>
    </div>
  );
}
