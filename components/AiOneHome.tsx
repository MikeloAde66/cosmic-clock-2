'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import CosmicCanvas from './CosmicCanvas';
import SignUpModal from './SignUpModal';
import DonationButton from './DonationButton';
import PricingPlans from './PricingPlans';
import ProductsStorefront from './ProductsStorefront';
import CartView from './CartView';
import { CartProvider, useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import type { VaultDrawer } from '@/lib/vaultRegistry';

interface AiOneHomeProps {
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
}

// Reads useCart() from inside <CartProvider>'s own subtree — rendered as a
// child of the provider below rather than called directly in AiOneHome's
// body, which sits outside the context it wraps.
function CartNavButton({ onClick }: { onClick: () => void }) {
  const { itemCount } = useCart();
  return (
    <button
      onClick={onClick}
      className="relative text-white/70 transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
    >
      <ShoppingCart className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />
      Cart
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-3 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-white text-black">
          {itemCount}
        </span>
      )}
    </button>
  );
}

export default function AiOneHome({ onNavigateToVaultDrawer }: AiOneHomeProps) {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'home' | 'pricing' | 'products' | 'cart'
  >('home');

  useEffect(() => {
    // Supabase's default email template sends a magic link, not a 6-digit
    // code — clicking it authenticates silently via a URL token rather than
    // going through the in-app "enter code" step. Catch that here so
    // onboarding (terms/profile) still continues instead of leaving the
    // user stranded on a closed modal despite being signed in.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      // Log In uses the same passwordless mechanism as Sign Up, so this
      // fires for both — only pop the Sign Up onboarding (terms/profile)
      // when the sign-in was actually initiated from Sign Up.
      if (
        event === 'SIGNED_IN' &&
        localStorage.getItem('cosmic_auth_intent') === 'signup'
      ) {
        setIsSignUpOpen(true);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <CartProvider>
      <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 flex flex-col font-sans">
        {/* HERO BANNER */}
        <div className="relative w-full h-80 bg-[#060a12] overflow-hidden border-b border-slate-800/80 flex flex-col items-center justify-center shrink-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/20 via-indigo-500/30 to-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/70" />

          <div className="relative z-10 px-4 space-y-2 text-center">
            <h1 className="text-5xl md:text-6xl font-black tracking-wider text-white">
              Ai One
            </h1>
            <p className="font-mono text-xs tracking-widest uppercase md:text-sm text-slate-300">
              Cosmic Creation & Broadcast Hub
            </p>
          </div>
        </div>

        {/* SUB-NAV: lightweight inline menu text, not pill buttons */}
        <div className="flex items-center justify-center w-full py-3 space-x-8 text-xs font-mono tracking-widest uppercase border-b border-slate-800/80 bg-[#0b1326] shrink-0">
          <button
            onClick={() => setActiveSection('products')}
            className="text-white/70 transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          >
            Products
          </button>

          <button
            onClick={() => setActiveSection('pricing')}
            className="text-white/70 transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          >
            Pricing
          </button>

          <button
            onClick={() => setIsSignUpOpen(true)}
            className="text-white hover:text-white font-bold border-b border-neutral-700 pb-0.5 transition-colors"
          >
            Sign Up
          </button>

          <CartNavButton onClick={() => setActiveSection('cart')} />

          <DonationButton />
        </div>

        <SignUpModal
          isOpen={isSignUpOpen}
          onClose={() => setIsSignUpOpen(false)}
        />

        {activeSection !== 'home' ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-6 pt-4 shrink-0">
              <button
                onClick={() => setActiveSection('home')}
                className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {activeSection === 'pricing' && <PricingPlans />}
              {activeSection === 'products' && <ProductsStorefront />}
              {activeSection === 'cart' && <CartView />}
            </div>
          </div>
        ) : (
          /* MAIN CONTENT VIEW: Cosmic Clock centerpiece, replacing the old video monitor */
          <div className="flex-1 w-full max-w-6xl px-6 py-10 mx-auto">
            <div className="w-full overflow-hidden border shadow-2xl bg-slate-950 border-slate-800 rounded-2xl">
              <div className="relative w-full aspect-video">
                <CosmicCanvas
                  onNavigateToVaultDrawer={onNavigateToVaultDrawer}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </CartProvider>
  );
}
