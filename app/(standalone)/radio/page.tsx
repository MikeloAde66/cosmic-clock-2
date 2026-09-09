'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import RadioCentralConsoleView from '@/components/radio/RadioCentralConsoleView';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';

// Reached at /radio on any domain pointing at this deployment, and ready
// for the same transparent rewrite-from-'/' treatment proxy.ts already
// gives startracker.pro.protolabsglobal.com, once a dedicated radio
// subdomain exists. No parent app shell wraps this on purpose — matches
// the (standalone)/star-tracker convention: a bare page for a
// single-purpose domain, not the main hub's LeftNav/TopHeader chrome.
// RadioPlayerProvider/GlobalPlayerBar live in the root layout, so playback
// started here survives navigating anywhere else in the app.
export default function StandaloneRadioPage() {
  // GlobalPlayerBar defaults to hidden app-wide (see RadioPlayerContext) —
  // this is Radio Central itself, one of the two views allowed to show it,
  // and this page mounts entirely outside app/page.tsx's own opt-in effect,
  // so it needs its own. Restores the hidden default on unmount so it
  // doesn't leak the bar into whatever route the user navigates to next.
  const { setPlayerBarHidden } = useRadioPlayer();
  useEffect(() => {
    setPlayerBarHidden(false);
    return () => setPlayerBarHidden(true);
  }, [setPlayerBarHidden]);

  return (
    <div className="relative flex flex-col w-full h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      {/* A slim bar above the console, not an absolute overlay on top of
          it — RadioCentralConsoleView has its own header content (the
          432Hz badge) starting right at its own top edge, so overlaying a
          back link there would collide with it. */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
      </div>
      <div className="flex-1 min-h-0">
        <RadioCentralConsoleView />
      </div>
    </div>
  );
}
