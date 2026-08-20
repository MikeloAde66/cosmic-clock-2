'use client';

import React from 'react';
import { Gift } from 'lucide-react';
import { useDonation } from '@/lib/useDonation';

// compact renders as a LeftNav-style 40x40 icon button with a hover
// tooltip, matching that sidebar's other items — for mounting this
// somewhere narrower than the wide text-button default (e.g. underneath
// the Kali Yuga icon). row renders as an icon+label list item matching
// LeftNav's mobile drawer rows. All three reuse the same donation-session
// handler (see lib/useDonation.ts — also shared by the Gallery Grid
// layout's Donate card).
export default function DonationButton({ compact = false, row = false }: { compact?: boolean; row?: boolean }) {
  const { loading, error, donate: handleDonation } = useDonation();

  if (compact) {
    return (
      <div className="relative group">
        <button
          onClick={handleDonation}
          disabled={loading}
          aria-label="Donate"
          className="flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 disabled:opacity-50"
        >
          <Gift className="w-4 h-4" />
        </button>
        <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
          {error || 'Donate'}
        </span>
      </div>
    );
  }

  if (row) {
    return (
      <button
        onClick={handleDonation}
        disabled={loading}
        className="flex items-center w-full gap-3 px-3 rounded-lg transition-all border border-transparent h-11 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 disabled:opacity-50"
      >
        <Gift className="w-4 h-4 shrink-0" />
        <span className="text-sm">{error || (loading ? 'Donate…' : 'Donate')}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleDonation}
        disabled={loading}
        className="px-4 py-2 text-xs font-mono tracking-widest uppercase border border-slate-700 bg-slate-900/80 hover:bg-slate-800 disabled:opacity-50 text-slate-200 rounded transition"
      >
        {loading ? '…' : 'Donations'}
      </button>
      {error && (
        <span className="text-[10px] font-mono text-red-400 tracking-wider">
          {error}
        </span>
      )}
    </div>
  );
}
