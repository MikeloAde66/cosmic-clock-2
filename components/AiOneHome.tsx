'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import CosmicCanvas from './CosmicCanvas';
import Starfield from './Starfield';
import SignUpModal from './SignUpModal';
import DonationButton from './DonationButton';
import PricingPlans from './PricingPlans';
import CartView from './CartView';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import type { VaultDrawer } from '@/lib/vaultRegistry';

interface AiOneHomeProps {
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
  // Set by LeftNav's Weather/Kali Yuga icons — forces this back to its main
  // 'home' section (in case the user was on Products/Pricing/Cart) and
  // passes the request through to CosmicCanvas, which actually owns the
  // Weather/Kali sub-view state.
  homeViewRequest?: { view: 'weather' | 'kali'; token: number } | null;
  // Bumped by LeftNav's Home icon (see page.tsx's groundZeroToken) — resets
  // this back to its main 'home' section AND tells CosmicCanvas to drop out
  // of Weather/Kali back to the clock view, since those no longer have
  // their own Back button.
  groundZeroToken?: number;
  // Bumped by page.tsx when the URL carries ?checkout=cancelled or
  // ?checkout=required (Stripe's cancel_url, or /dashboard bouncing a
  // signed-in visitor with no active plan back here) — jumps straight to
  // the Pricing section instead of leaving them stranded on Home.
  pricingRequestToken?: number;
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

export default function AiOneHome({
  onNavigateToVaultDrawer,
  homeViewRequest,
  groundZeroToken,
  pricingRequestToken,
}: AiOneHomeProps) {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'home' | 'pricing' | 'cart'>('home');
  // CosmicCanvas's Weather/Kali sub-views already have their own BackButton
  // — keeping this hero banner + sub-nav above them too just stacked a
  // second navigation layer and pushed those views' content down by ~380px
  // with nothing to match it at the bottom. Collapse this chrome once the
  // user is inside one of those, same as they already collapse for
  // Products/Pricing/Cart via the activeSection check below.
  const [cosmicView, setCosmicView] = useState<'clock' | 'weather' | 'kali'>('clock');
  const showHeroChrome = activeSection !== 'home' || cosmicView === 'clock';

  // A LeftNav Weather/Kali click can arrive while this is showing
  // Products/Pricing/Cart — snap back to the main section so CosmicCanvas
  // (which owns the actual sub-view) is mounted to receive the request.
  useEffect(() => {
    if (homeViewRequest) queueMicrotask(() => setActiveSection('home'));
  }, [homeViewRequest]);

  useEffect(() => {
    if (groundZeroToken) queueMicrotask(() => setActiveSection('home'));
  }, [groundZeroToken]);

  useEffect(() => {
    if (pricingRequestToken) queueMicrotask(() => setActiveSection('pricing'));
  }, [pricingRequestToken]);

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
    <div className="relative z-10 w-full h-full overflow-y-auto text-slate-100 flex flex-col font-sans">
      {showHeroChrome && (
        <>
          {/* HERO BANNER */}
          <div className="relative w-full h-80 bg-[#060a12] overflow-hidden border-b border-slate-800/80 flex flex-col items-center justify-center shrink-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/20 via-indigo-500/30 to-white/10 rounded-full blur-3xl pointer-events-none" />
            {/* Second, self-contained Starfield instance — the global one
                (mounted in app/page.tsx) sits behind the whole app, but this
                banner's own opaque background fully hides it. Same star
                logic/drift timing as the global instance, just scoped to
                this banner instead of the viewport, at a lower count
                proportional to its much smaller area. */}
            <Starfield contained starCount={170} />
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

          {/* SUB-NAV: lightweight inline menu text, not pill buttons.
              Products/merch moved into the Vault's Merch drawer — see
              CosmicVaultAuth — so this main platform sub-nav stays
              focused on the core space/broadcast tools. */}
          <div className="flex items-center justify-center w-full py-3 space-x-8 text-xs font-mono tracking-widest uppercase border-b border-slate-800/80 bg-[#0b1326] shrink-0">
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
        </>
      )}

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
            {activeSection === 'cart' && <CartView />}
          </div>
        </div>
      ) : (
        /* MAIN CONTENT VIEW: Cosmic Clock centerpiece, full-bleed so the
           starfield/space background fills the whole viewport instead of
           sitting inside a bordered, max-width, 16:9-locked card. */
        <div className="relative flex-1 w-full min-h-0">
          <CosmicCanvas
            onNavigateToVaultDrawer={onNavigateToVaultDrawer}
            onViewChange={setCosmicView}
            requestedView={homeViewRequest}
            groundZeroToken={groundZeroToken}
          />
        </div>
      )}
    </div>
  );
}
