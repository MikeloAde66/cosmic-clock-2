'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, LayoutGrid, Mic, Radio as RadioIcon, Settings, Sparkles, Umbrella } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PreferencesModal from './PreferencesModal';
import DonationButton from './DonationButton';

// The Ai One emblem — an angled open loop ("a") paired with a parallel
// diagonal stem and dot ("i"). No background shape of its own; the
// off-white color is set by the wrapping badge's text color below via
// currentColor, so it inherits theme changes rather than being hardcoded
// twice.
function AiOneEmblem() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-6 h-6" aria-hidden="true">
      <path
        d="M 27.29 54.12 A 13 17 -22 1 1 35.29 37.38"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M 46 16 L 33 50" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <circle cx="49" cy="8" r="4.5" fill="currentColor" />
    </svg>
  );
}

interface LeftNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  // Called with a validated role key once matchRole confirms it's real —
  // the actual unlock still happens inside CosmicVaultAuth itself (defense
  // in depth: this modal is just the only reachable *path* to it now).
  onUnlockVault?: (roleKey: string) => void;
  // Owner Vault Access Rule — see PreferencesModal.
  onOpenVaultForOwner?: () => void;
  // Opens the Home tab's Weather/Kali Yuga sub-views directly, replacing
  // the pill buttons that used to float over the 3D Earth canvas.
  onOpenHomeView?: (view: 'weather' | 'kali') => void;
  // The Home icon's dedicated "ground zero" behavior — always returns to
  // the main clock view, collapsing out of Weather/Kali/Products/Pricing/
  // Cart, not just switching tabs. Those sub-views no longer have their own
  // Back button, so this is now the only way out of them.
  onGroundZero?: () => void;
}

// Cosmic Vault is intentionally absent from this list — see the Vault
// Access field in the Preferences modal below, the only remaining way in.
const NAV_ITEMS = [
  { key: 'aione', label: 'Home', Icon: Home },
  { key: 'radio', label: 'Radio', Icon: RadioIcon },
  { key: 'pods', label: 'Pods Studio', Icon: Mic },
];

export default function LeftNav({
  activeTab = 'aione',
  setActiveTab,
  onUnlockVault,
  onOpenVaultForOwner,
  onOpenHomeView,
  onGroundZero,
}: LeftNavProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.app_metadata?.role === 'admin');
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(session?.user?.app_metadata?.role === 'admin');
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleNavClick = (tabKey: string) => {
    // Home is "ground zero" — always collapse back to the main clock view,
    // not just switch tabs, since Weather/Kali/Products/Pricing/Cart no
    // longer have their own way back out.
    if (tabKey === 'aione') {
      onGroundZero?.();
      return;
    }
    setActiveTab?.(tabKey);
  };

  return (
    <>
      {/* pb-16 (vs. a plain py-4) keeps the Preferences button clear of the
          bottom-left corner, where Next.js's own dev-tools indicator lives
          in local dev (production has no such overlay, but there's no
          reason to fight it in dev either). */}
      <aside className="relative z-10 flex flex-col items-center justify-between w-16 min-h-screen pt-4 pb-16 bg-neutral-950/30 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6">
          <div
            title="AIONE — Cosmic HUD"
            className="flex items-center justify-center w-10 h-10 border rounded-full border-neutral-700 bg-neutral-900 text-[#EBE7DF]"
          >
            <AiOneEmblem />
          </div>

          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map(({ key, label, Icon }) => (
              <div key={key} className="relative group">
                <button
                  onClick={() => handleNavClick(key)}
                  aria-label={label}
                  className={`flex items-center justify-center w-10 h-10 rounded transition-all cursor-pointer border ${
                    activeTab === key
                      ? 'bg-neutral-900 text-white border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
                {/* Hover tooltip drawer — click-to-open activation above is
                    what changes the view; this is purely a label, so it
                    never causes layout shift in the main canvas. */}
                <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                  {label}
                </span>
              </div>
            ))}

            {/* Products/Showcase — a real standalone route (/products), not
                an activeTab switch like Home/Radio/Pods above, so this is a
                genuine navigation via <Link> rather than handleNavClick. */}
            <div className="relative group">
              <Link
                href="/products"
                aria-label="Products"
                className="flex items-center justify-center w-10 h-10 rounded transition-all cursor-pointer border text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent"
              >
                <LayoutGrid className="w-4 h-4" />
              </Link>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Products
              </span>
            </div>

            {/* Weather / Kali Yuga — moved here from the floating pill
                buttons that used to sit over the 3D Earth canvas. Each
                jumps to the Home tab's matching sub-view via
                onOpenHomeView, forcing Home back to its main section first
                if the user was on Products/Pricing/Cart. */}
            <div className="relative group">
              <button
                onClick={() => onOpenHomeView?.('weather')}
                aria-label="Weather"
                className="flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Umbrella className="w-4 h-4" />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Weather
              </span>
            </div>

            <div className="relative group">
              <button
                onClick={() => onOpenHomeView?.('kali')}
                aria-label="Ai"
                className="flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer text-white hover:bg-neutral-900/50"
              >
                <Sparkles className="w-4 h-4 animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Ai
              </span>
            </div>

            {/* Donations — relocated here from the Home tab's sub-nav,
                directly underneath Kali Yuga. */}
            <DonationButton compact />
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3 pt-4 mt-4 border-t border-neutral-900">
          {isAdmin && (
            <span
              title="Admin authorized"
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            />
          )}
          <div className="relative group">
            <button
              onClick={() => setShowPreferences(true)}
              aria-label="Preferences"
              className="flex items-center justify-center w-10 h-10 transition-all rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
            >
              <Settings className="w-4 h-4" />
            </button>
            <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
              Preferences
            </span>
          </div>
        </div>
      </aside>

      {showPreferences && (
        <PreferencesModal
          isAdmin={isAdmin}
          onClose={() => setShowPreferences(false)}
          onUnlockVault={(key) => onUnlockVault?.(key)}
          onOpenVaultForOwner={() => onOpenVaultForOwner?.()}
        />
      )}
    </>
  );
}
