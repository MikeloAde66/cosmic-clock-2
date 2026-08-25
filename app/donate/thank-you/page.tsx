'use client';

import React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import Starfield from '@/components/Starfield';

// Real destination for the navbar Donate button's Stripe Payment Link —
// set this URL as that link's "After payment" redirect in the Stripe
// dashboard so genuine donors land here instead of Stripe's generic
// default confirmation screen. Deliberately warmer than the transactional
// hardware-preorder thank-you page: a gift, not a purchase, so the tone
// here is thanksgiving, not "here's your order number."
export default function DonateThankYouPage() {
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
        <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-rose-950/50 border border-rose-800/60">
          <Heart className="w-7 h-7 text-rose-300" fill="currentColor" />
        </div>
        <h1 className="max-w-lg text-3xl font-bold text-white">Thank you, truly.</h1>
        <p className="max-w-md mt-4 text-sm leading-relaxed text-neutral-300">
          Your gift just went straight into keeping Ai One alive and growing — every server hour, every
          new feature, every station on Radio Central runs on support like yours. Whether it was $5 or
          $500, it mattered, and we felt it.
        </p>
        <p className="max-w-md mt-4 text-sm leading-relaxed text-neutral-400">
          We built this because we believe in it, and knowing someone else does too, enough to back it
          with a real gift, means more than a confirmation page can really say. So: thank you. Sincerely.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 mt-10 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
        >
          Back to Ai One →
        </Link>
      </div>
    </div>
  );
}
