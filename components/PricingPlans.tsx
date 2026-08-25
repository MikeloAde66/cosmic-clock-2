import React from 'react';
import PurchaseButton from '@/components/PurchaseButton';
import { AIONE_PRO_SUBSCRIPTION_LINK } from '@/lib/paymentLinks';

// Single-plan card — replaces the old 4-tier grid (Hobby/Freelancer/
// Startup/Enterprise) per explicit simplification decision. Checkout is a
// real Stripe Payment Link now (see PurchaseButton), not the old
// createCheckoutSession server action, so there's no priceId/userId/
// userEmail plumbing left to do here at all. A multi-tier grid can come
// back later as its own component if the product expands again.
export default function PricingPlans() {
  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-md px-6 py-10 mx-auto space-y-8">
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold text-white">Pricing</h2>
          <p className="max-w-lg mx-auto text-sm text-slate-400">
            One plan. Everything Ai One has to offer.
          </p>
        </div>

        <div className="flex flex-col justify-between p-6 space-y-5 border rounded-xl bg-[#0B0E14]/80 backdrop-blur-sm border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.12)]">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white">Start Your 14-Day Free Trial</h3>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">$12</span>
              <span className="text-xs text-slate-500">/month</span>
            </div>
            <p className="text-xs text-slate-400">$12/month after trial. Cancel anytime.</p>
          </div>

          <PurchaseButton
            label="Start 14-Day Free Trial"
            link={AIONE_PRO_SUBSCRIPTION_LINK}
            featured
            pendingLabel="Subscription link pending"
          />
        </div>
      </div>
    </div>
  );
}
