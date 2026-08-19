'use client';

import React, { useEffect, useState } from 'react';
import ISSFeedModal from './ISSFeedModal';
import LoginModal from './LoginModal';
import SignUpModal from './SignUpModal';
import StarTrackerView from './StarTrackerView';
import { supabase } from '@/lib/supabase';

interface TopHeaderProps {
  activeTab?: string;
  // Jumps to the Home tab's Pricing section — Pricing itself still lives
  // inside AiOneHome (see page.tsx's pricingRequestToken), this just
  // triggers it from here now that the button lives in the header instead
  // of AiOneHome's own sub-nav.
  onOpenPricing?: () => void;
}

export default function TopHeader({ activeTab, onOpenPricing }: TopHeaderProps) {
  const [isIssOpen, setIsIssOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isStarTrackerOpen, setIsStarTrackerOpen] = useState(false);
  const isHome = activeTab === 'aione';

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

  // Supabase's default email template is a magic link, not a 6-digit code —
  // a SIGNED_IN event fired from clicking that link is otherwise silent, so
  // reopen the Sign Up onboarding (terms/profile) whenever the visitor's
  // last auth action was actually starting the Sign Up flow, not Log In.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && localStorage.getItem('cosmic_auth_intent') === 'signup') {
        setIsSignUpOpen(true);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-4 py-3 bg-neutral-950/30 backdrop-blur-sm">
        {/* Left Side: LIVE ISS + Star Tracker + Pricing */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsIssOpen(true)}
            className="flex items-center px-3 py-1 space-x-2 font-mono text-xs transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-red-500/40 hover:border-red-500 text-neutral-200"
          >
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span>LIVE ISS</span>
          </button>

          <button
            onClick={() => setIsStarTrackerOpen(true)}
            className="flex items-center px-3 py-1 space-x-2 font-mono text-xs transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-cyan-500/40 hover:border-cyan-400 text-neutral-200"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>STAR TRACKER</span>
          </button>

          <button
            onClick={() => onOpenPricing?.()}
            className="px-3 py-1 font-mono text-xs uppercase tracking-wide transition-all border rounded-full cursor-pointer bg-neutral-900/80 border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white"
          >
            Pricing
          </button>
        </div>

        {/* Right Side: Auth Controls (search now lives on the Radio page only) */}
        <div className="flex items-center space-x-2">
          {isHome ? (
            <>
              <button
                onClick={() => setIsSignUpOpen(true)}
                className="px-3 py-1 text-xs font-bold border-b border-neutral-700 text-white hover:text-white transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={() => setIsLoginOpen(true)}
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
            onClick={() => setIsLoginOpen(true)}
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

      {/* ISS Stream Modal */}
      <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />

      {/* Log In Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Sign Up Modal — moved here from AiOneHome's sub-nav, next to Log In */}
      <SignUpModal isOpen={isSignUpOpen} onClose={() => setIsSignUpOpen(false)} />

      {/* Star Tracker — a dedicated full-screen view, not a stacked modal */}
      {isStarTrackerOpen && <StarTrackerView onBack={() => setIsStarTrackerOpen(false)} />}
    </>
  );
}
