'use client';

import React, { useEffect, useState } from 'react';
import AuthModal from './AuthModal';
import LayoutModeToggle, { type LayoutMode } from './LayoutModeToggle';
import NavbarDonateButton from './NavbarDonateButton';
import { supabase } from '@/lib/supabase';

interface TopHeaderProps {
  activeTab?: string;
  // Jumps to the Home tab's Pricing section — Pricing itself still lives
  // inside AiOneHome (see page.tsx's pricingRequestToken), this just
  // triggers it from here now that the button lives in the header instead
  // of AiOneHome's own sub-nav.
  onOpenPricing?: () => void;
  // Layout Toggle feature — mode state itself lives in page.tsx (the
  // common ancestor that also decides what to render based on it), this
  // just hosts the selector UI in persistent chrome.
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (mode: LayoutMode) => void;
  // Set by page.tsx from a real ?auth=login/?auth=signup URL param — the
  // deep-link the protolabsglobal-main-shell static site's Log In/Sign Up
  // buttons point at, so this modal opens directly on arrival.
  authModalRequest?: { mode: 'login' | 'signup'; token: number } | null;
}

// Live ISS and Star Tracker used to live here as header pills — both moved
// to LeftNav (Satellite/Telescope icons, alongside the other core view
// options) per direct request, along with the state/modals that drove them
// (now owned by page.tsx, the common ancestor of LeftNav and this header).
// Pricing is the only item left in this section, so the mobile-only
// collapse-into-a-dropdown mechanism that used to hold all three together
// no longer serves a purpose — Pricing renders directly at every size now.
export default function TopHeader({
  activeTab,
  onOpenPricing,
  layoutMode,
  onLayoutModeChange,
  authModalRequest,
}: TopHeaderProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };
  const isHome = activeTab === 'aione';

  // A real ?auth=login/?auth=signup deep-link — see page.tsx. Reacts to
  // the token, not just the mode, so requesting the same mode again still
  // reopens it.
  const [lastAuthToken, setLastAuthToken] = useState<number | null>(null);
  useEffect(() => {
    if (!authModalRequest || authModalRequest.token === lastAuthToken) return;
    setLastAuthToken(authModalRequest.token);
    openAuth(authModalRequest.mode);
  }, [authModalRequest, lastAuthToken]);

  // Real session, not just isAdmin (LeftNav's check) — any signed-in
  // account counts here, since this button represents "is someone logged
  // in at all," not vault access. Drives the avatar button below: a blank,
  // fully transparent placeholder until a real account exists, then real
  // initials derived from that account's own email.
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAccountEmail(data.user?.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(session?.user?.email ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);
  const accountInitials = accountEmail ? accountEmail.slice(0, 2).toUpperCase() : '';

  return (
    <>
      <header className="relative z-10 flex items-center justify-between py-3 pr-4 pl-16 bg-neutral-950/30 backdrop-blur-sm md:pl-4">
        {/* Left Side: Pricing only now — pl-16 above clears LeftNav's fixed
            mobile hamburger trigger (top-3 left-3, md:hidden). */}
        <div className="flex items-center">
          <button
            onClick={() => onOpenPricing?.()}
            className="px-3 py-1 font-mono text-xs uppercase tracking-wide transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white"
          >
            Pricing
          </button>
        </div>

        {/* Right Side: Layout Toggle + Auth Controls (search now lives on
            the Radio page only) */}
        <div className="flex items-center space-x-2">
          <NavbarDonateButton />
          {layoutMode && onLayoutModeChange && (
            <LayoutModeToggle mode={layoutMode} onChange={onLayoutModeChange} />
          )}
          {isHome ? (
            <>
              <button
                onClick={() => openAuth('signup')}
                className="px-3 py-1 text-xs font-bold border-b border-neutral-700 text-white hover:text-white transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={() => openAuth('login')}
                className="px-3 py-1 ml-1 text-xs border rounded bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-neutral-300"
              >
                Log In
              </button>
            </>
          ) : (
            <button className="px-3 py-1 text-xs font-semibold rounded bg-white hover:bg-neutral-200 text-neutral-950">
              Share
            </button>
          )}
          <button
            onClick={() => openAuth('login')}
            title={accountEmail ? 'Account Profile' : 'Log In'}
            className={`flex items-center justify-center w-8 h-8 text-xs font-semibold rounded-full transition border ${
              accountEmail
                ? 'text-white bg-neutral-800 border-neutral-700 hover:border-neutral-500'
                : 'bg-transparent border-transparent hover:border-neutral-800'
            }`}
          >
            {accountInitials}
          </button>
        </div>
      </header>

      {/* Unified Log In / Create Account modal — tabs between modes, magic
          link or password, real Supabase calls either way. */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} />
    </>
  );
}
