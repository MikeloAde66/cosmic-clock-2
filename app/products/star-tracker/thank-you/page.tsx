'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Starfield from '@/components/Starfield';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
        <div className="flex items-center justify-center w-14 h-14 mb-6 rounded-full bg-emerald-950/60 border border-emerald-800">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Purchase complete</h1>
        <p className="max-w-md mt-3 text-sm text-neutral-400">
          Star Tracker is unlocked on your account. There's no separate app to install — open it from
          the top bar in the main app any time.
        </p>
        {sessionId && (
          <p className="mt-4 font-mono text-[10px] text-neutral-600">Order: {sessionId}</p>
        )}
        <Link
          href="/"
          className="px-4 py-2 mt-8 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
        >
          Open Ai One →
        </Link>
      </div>
    </div>
  );
}

export default function StarTrackerThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouContent />
    </Suspense>
  );
}
