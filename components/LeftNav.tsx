'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  LayoutGrid,
  Menu,
  Mic,
  Radio as RadioIcon,
  Rocket,
  Satellite,
  Settings,
  Sparkles,
  Telescope,
  Umbrella,
  X as CloseIcon,
} from 'lucide-react';
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
  // Opens the Home tab's Kali Yuga sub-view directly, replacing the pill
  // buttons that used to float over the 3D Earth canvas. Weather no longer
  // goes through here — see onWeatherClick/onWeatherDoubleClick below.
  onOpenHomeView?: (view: 'weather' | 'kali') => void;
  // The Home icon's dedicated "ground zero" behavior — always returns to
  // the main clock view, collapsing out of Kali/Products/Pricing/Cart, not
  // just switching tabs. Those sub-views no longer have their own Back
  // button, so this is now the only way out of them.
  onGroundZero?: () => void;
  // Umbrella icon — single click toggles the inline search (rendered in
  // SiteFooter, not a popup here, per the "no overlay" rule); double click
  // quick-views the last searched location. Deliberately does not navigate
  // or switch tabs — this is persistent chrome, available everywhere.
  onWeatherClick?: () => void;
  onWeatherDoubleClick?: () => void;
  // Drives the icon's green "active" state once a forecast is showing.
  weatherActive?: boolean;
  // Continuous Stack mode has a real embedded Products section (unlike
  // Weather/Vault) — when active, Products becomes a scroll-to button
  // instead of a real <Link> away to /products, consistent with every
  // other nav item staying on the same continuous page in this mode.
  isStackMode?: boolean;
  onProductsClick?: () => void;
  // Star Tracker/Live ISS — moved here from TopHeader's pills. Star
  // Tracker is a real on/off toggle (green dot open, red dot closed);
  // Live ISS just opens its existing modal, same as before, only relocated.
  isStarTrackerOpen?: boolean;
  onToggleStarTracker?: () => void;
  onOpenLiveIss?: () => void;
}

// Cosmic Vault is intentionally absent from this list — see the Vault
// Access field in the Preferences modal below, the only remaining way in.
const NAV_ITEMS = [
  { key: 'aione', label: 'Home', Icon: Home },
  { key: 'radio', label: 'Radio Central', Icon: RadioIcon },
  { key: 'pods', label: 'Studio One', Icon: Mic },
];

export default function LeftNav({
  activeTab = 'aione',
  setActiveTab,
  onUnlockVault,
  onOpenVaultForOwner,
  onOpenHomeView,
  onGroundZero,
  onWeatherClick,
  onWeatherDoubleClick,
  weatherActive = false,
  isStackMode = false,
  onProductsClick,
  isStarTrackerOpen = false,
  onToggleStarTracker,
  onOpenLiveIss,
}: LeftNavProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  // Mobile/tablet only (< md) — the icon rail below is hidden and replaced
  // by a hamburger trigger + slide-out drawer holding the same nav items.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
    setIsDrawerOpen(false);
    // Home is "ground zero" — always collapse back to the main clock view,
    // not just switch tabs, since Weather/Kali/Products/Pricing/Cart no
    // longer have their own way back out.
    if (tabKey === 'aione') {
      onGroundZero?.();
      return;
    }
    setActiveTab?.(tabKey);
  };

  const handleHomeViewClick = (view: 'weather' | 'kali') => {
    setIsDrawerOpen(false);
    onOpenHomeView?.(view);
  };

  return (
    <>
      {/* Mobile/tablet trigger (< md) — the icon rail is hidden below md,
          this hamburger opens the slide-out drawer instead. */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Open navigation menu"
        className="fixed z-40 flex items-center justify-center w-10 h-10 text-white border rounded-full top-3 left-3 md:hidden bg-neutral-950/80 backdrop-blur-sm border-neutral-700"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop + slide-out drawer (< md only) — same nav items as the
          desktop rail below, just with text labels since there's room. */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 gap-6 pt-4 pb-8 overflow-y-auto transition-transform duration-200 border-r bg-neutral-950 border-neutral-800 md:hidden ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4">
          <div
            title="AIONE — Cosmic HUD"
            className="flex items-center justify-center w-10 h-10 border rounded-full border-neutral-700 bg-neutral-900 text-[#EBE7DF]"
          >
            <AiOneEmblem />
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="flex items-center justify-center w-8 h-8 rounded text-neutral-400 hover:text-white hover:bg-neutral-900"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => handleNavClick(key)}
              className={`flex items-center gap-3 h-11 px-3 rounded-lg transition-all border ${
                activeTab === key
                  ? 'bg-neutral-900 text-white border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm">{label}</span>
            </button>
          ))}

          {isStackMode ? (
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                onProductsClick?.();
              }}
              className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="text-sm">Products</span>
            </button>
          ) : (
            <Link
              href="/products"
              onClick={() => setIsDrawerOpen(false)}
              className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="text-sm">Products</span>
            </Link>
          )}

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              onToggleStarTracker?.();
            }}
            className="relative flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <span className="relative shrink-0">
              <Telescope className="w-4 h-4" />
              <span
                className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                  isStarTrackerOpen ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </span>
            <span className="text-sm">Star Tracker</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              onOpenLiveIss?.();
            }}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <Satellite className="w-4 h-4 shrink-0" />
            <span className="text-sm">Live ISS</span>
          </button>

          <a
            href="https://plus.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsDrawerOpen(false)}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <Rocket className="w-4 h-4 shrink-0" />
            <span className="text-sm">NASA News</span>
          </a>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              onWeatherClick?.();
            }}
            onDoubleClick={() => {
              setIsDrawerOpen(false);
              onWeatherDoubleClick?.();
            }}
            className={`flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent hover:bg-neutral-900/50 ${
              weatherActive ? 'text-green-400 hover:text-green-300' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Umbrella className="w-4 h-4 shrink-0" />
            <span className="text-sm">Weather</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              onGroundZero?.();
            }}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-white hover:bg-neutral-900/50"
          >
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            <span className="text-sm">Ai</span>
          </button>

          <DonationButton row />

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              setShowPreferences(true);
            }}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="text-sm">Preferences</span>
          </button>
        </nav>
      </aside>

      {/* Desktop icon rail (md+) — pb-16 (vs. a plain py-4) keeps the
          Preferences button clear of the bottom-left corner, where Next.js's
          own dev-tools indicator lives in local dev (production has no such
          overlay, but there's no reason to fight it in dev either). */}
      <aside className="relative z-10 hidden flex-col items-center justify-between w-16 min-h-screen pt-4 pb-16 bg-neutral-950/30 backdrop-blur-sm md:flex">
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

            {/* Products/Showcase — a real standalone route (/products)
                normally, so a genuine navigation via <Link>; in Stack mode
                there's a real embedded Products section instead, so this
                becomes a scroll-to button like Home/Radio/Pods, keeping the
                user on the same continuous page. */}
            <div className="relative group">
              {isStackMode ? (
                <button
                  onClick={() => onProductsClick?.()}
                  aria-label="Products"
                  className="flex items-center justify-center w-10 h-10 rounded transition-all cursor-pointer border text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href="/products"
                  aria-label="Products"
                  className="flex items-center justify-center w-10 h-10 rounded transition-all cursor-pointer border text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Link>
              )}
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Products
              </span>
            </div>

            {/* Star Tracker / Live ISS — moved here from TopHeader's pills.
                Star Tracker keeps a real on/off toggle (green dot open, red
                closed); Live ISS just opens its existing modal. */}
            <div className="relative group">
              <button
                onClick={() => onToggleStarTracker?.()}
                aria-label="Star Tracker"
                className="relative flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Telescope className="w-4 h-4" />
                <span
                  className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                    isStarTrackerOpen ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Star Tracker
              </span>
            </div>

            <div className="relative group">
              <button
                onClick={() => onOpenLiveIss?.()}
                aria-label="Live ISS"
                className="flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Satellite className="w-4 h-4" />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Live ISS
              </span>
            </div>

            <div className="relative group">
              <a
                href="https://plus.nasa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="NASA News"
                className="flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Rocket className="w-4 h-4" />
              </a>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                NASA News
              </span>
            </div>

            {/* Weather / Kali Yuga — moved here from the floating pill
                buttons that used to sit over the 3D Earth canvas. Each
                jumps to the Home tab's matching sub-view via
                onOpenHomeView, forcing Home back to its main section first
                if the user was on Products/Pricing/Cart. */}
            <div className="relative group">
              <button
                onClick={() => onWeatherClick?.()}
                onDoubleClick={() => onWeatherDoubleClick?.()}
                aria-label="Weather"
                className={`flex items-center justify-center w-10 h-10 transition-all border border-transparent rounded cursor-pointer hover:bg-neutral-900/50 ${
                  weatherActive ? 'text-green-400 hover:text-green-300' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Umbrella className="w-4 h-4" />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Weather
              </span>
            </div>

            <div className="relative group">
              <button
                onClick={() => onGroundZero?.()}
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
