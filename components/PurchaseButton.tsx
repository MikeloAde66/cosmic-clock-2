import React from 'react';

// Plain <a> to a hosted Stripe Payment Link — no API calls, no server
// action, no STRIPE_SECRET_KEY involved at all. Stripe's own hosted page
// handles the entire charge; this component's only job is opening the URL
// it's given.
interface PurchaseButtonProps {
  label: string;
  // Empty until a real Payment Link URL exists — renders as an honest
  // disabled state instead of a dead href="" or a fabricated placeholder
  // URL. See lib/paymentLinks.ts.
  link: string;
  featured?: boolean;
  newTab?: boolean;
  pendingLabel?: string;
}

export default function PurchaseButton({
  label,
  link,
  featured = false,
  newTab = true,
  pendingLabel = 'Link pending',
}: PurchaseButtonProps) {
  const sharedClasses = `block w-full py-3 text-sm font-mono font-bold uppercase tracking-wide text-center rounded-lg transition ${
    featured
      ? 'bg-white text-black hover:bg-neutral-200'
      : 'bg-slate-900/60 border border-cyan-500/40 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-950/30'
  }`;

  if (!link) {
    return (
      <button type="button" disabled className={`${sharedClasses} opacity-40 cursor-not-allowed`}>
        {pendingLabel}
      </button>
    );
  }

  return (
    <a
      href={link}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      className={sharedClasses}
    >
      {label}
    </a>
  );
}
