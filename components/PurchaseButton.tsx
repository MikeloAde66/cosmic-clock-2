'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Plain <a> to a hosted Stripe Payment Link — no API calls, no server
// action, no STRIPE_SECRET_KEY involved at all. Stripe's own hosted page
// handles the entire charge; this component's only real job beyond opening
// the URL is attaching ?client_reference_id=<supabase user id> when
// attachUserId is set and someone's logged in, so the webhook's
// resolveUserId() (see app/api/webhooks/stripe/route.ts) can tie a real
// Payment-Link purchase back to their account without needing our own
// checkout Server Action. If no one's logged in (or attachUserId is off),
// the link is used as-is — the webhook still has an email-match fallback,
// just a less certain one.
interface PurchaseButtonProps {
  label: string;
  // Empty until a real Payment Link URL exists — renders as an honest
  // disabled state instead of a dead href="" or a fabricated placeholder
  // URL. See lib/paymentLinks.ts.
  link: string;
  featured?: boolean;
  newTab?: boolean;
  pendingLabel?: string;
  attachUserId?: boolean;
}

export default function PurchaseButton({
  label,
  link,
  featured = false,
  newTab = true,
  pendingLabel = 'Link pending',
  attachUserId = false,
}: PurchaseButtonProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!attachUserId) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [attachUserId]);

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

  const href = userId ? `${link}${link.includes('?') ? '&' : '?'}client_reference_id=${encodeURIComponent(userId)}` : link;

  return (
    <a href={href} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined} className={sharedClasses}>
      {label}
    </a>
  );
}
