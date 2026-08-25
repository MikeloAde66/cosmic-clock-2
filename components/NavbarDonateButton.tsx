import React from 'react';
import { Heart } from 'lucide-react';
import { DONATION_LINK } from '@/lib/paymentLinks';

// Real Stripe Payment Link, wired only here (top navbar) — deliberately
// separate from the existing sidebar/gallery DonationButton, which still
// uses the older createDonationSession API flow. "Before" gratitude is
// this button's own warm copy/tooltip (the actual checkout page is
// Stripe's own hosted page, out of our control); "after" gratitude lives
// at /donate/thank-you, once the Payment Link's redirect points there.
export default function NavbarDonateButton() {
  if (!DONATION_LINK) {
    return (
      <button
        type="button"
        disabled
        title="Donation link pending"
        className="flex items-center gap-1.5 px-3 py-1 text-xs border rounded-full opacity-40 cursor-not-allowed bg-neutral-900 border-neutral-700 text-neutral-400"
      >
        <Heart className="w-3.5 h-3.5" />
        Donate
      </button>
    );
  }

  return (
    <a
      href={DONATION_LINK}
      target="_blank"
      rel="noopener noreferrer"
      title="Every gift, big or small, is real fuel for Ai One — thank you."
      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border rounded-full transition bg-rose-950/40 border-rose-800/60 text-rose-200 hover:border-rose-500 hover:bg-rose-950/70"
    >
      <Heart className="w-3.5 h-3.5" fill="currentColor" />
      Donate
    </a>
  );
}
