'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import PurchaseButton from '@/components/PurchaseButton';
import AuthModal from '@/components/AuthModal';
import { AIONE_PRO_SUBSCRIPTION_LINK } from '@/lib/paymentLinks';

interface TrialGateModalProps {
  onClose: () => void;
}

// Shown when a signed-out visitor clicks any of the 9 dashboard cards on
// the direct subdomain. Deliberately thin: the actual trial/checkout
// mechanism is the same real Stripe Payment Link PricingPlans.tsx already
// uses (via PurchaseButton — Stripe's own hosted checkout collects and
// verifies email itself, so there's no separate email form to build here),
// and "log in" reuses the existing AuthModal rather than a new auth flow.
// Once a visit results in a real Supabase session (checkout or login),
// useIsSignedIn() in GalleryGrid.tsx unlocks the cards for real — this
// modal has no state of its own to reconcile with that.
export default function TrialGateModal({ onClose }: TrialGateModalProps) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm p-6 space-y-5 border shadow-2xl rounded-2xl border-cyan-500/20 bg-slate-950">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        <div className="space-y-2 text-center">
          <h3 className="text-lg font-bold text-white">Start Your Free 14-Day Trial</h3>
          <p className="text-xs text-slate-400">
            Unlock every card on this dashboard — Radio Central, Studio One, Kali, and the rest — with a free 14-day
            trial. $12/month after, cancel anytime.
          </p>
        </div>

        <PurchaseButton
          label="Start 14-Day Free Trial"
          link={AIONE_PRO_SUBSCRIPTION_LINK}
          featured
          pendingLabel="Subscription link pending"
          attachUserId
        />

        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className="w-full text-xs text-center text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          Already started a trial? Log in
        </button>
      </div>

      <AuthModal isOpen={showLogin} onClose={() => setShowLogin(false)} initialMode="login" />
    </div>
  );
}
