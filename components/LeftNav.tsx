'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Home,
  Layers,
  LayoutGrid,
  Menu,
  MessageCircle,
  Mic,
  Radio as RadioIcon,
  Rows3,
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
import ProtoLabsLogo from './ProtoLabsLogo';
import type { LayoutMode } from './LayoutModeToggle';

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
  // Star Tracker — moved here from TopHeader's pills; a real on/off toggle
  // (green dot open, red dot closed). Live ISS has no callback prop
  // anymore — its nav entry is a non-interactive placeholder now (visible
  // but pointer-events-none, per the "clean minimal nav" restructure), so
  // there is nothing left to click for it to call.
  isStarTrackerOpen?: boolean;
  onToggleStarTracker?: () => void;
  // Opens the dedicated "Let's Chat" community view (TenForwardSection,
  // renamed — was only reachable via Continuous Stack's scroll flow
  // before, now a real nav destination from any layout mode).
  onOpenLetsChat?: () => void;
  // Classic Hub / Gallery Grid / Continuous Stack — previously a standalone
  // LayoutModeToggle pill in TopHeader; folded in here as three plain rows
  // once TopHeader's own toggle was removed, since without this the Gallery
  // Grid view had no way to ever be reached at all.
  layoutMode?: LayoutMode;
  onChangeLayoutMode?: (mode: LayoutMode) => void;
}

// Cosmic Vault is intentionally absent from this list — see the Vault
// Access field in the Preferences modal below, the only remaining way in.
const NAV_ITEMS = [
  { key: 'aione', label: 'Home', Icon: Home },
  { key: 'radio', label: 'Radio Central', Icon: RadioIcon },
  { key: 'pods', label: 'Studio One', Icon: Mic },
];

const LAYOUT_MODES: { key: LayoutMode; label: string; Icon: typeof Layers }[] = [
  { key: 'hub', label: 'Classic Hub', Icon: Layers },
  { key: 'gallery', label: 'Gallery Grid', Icon: LayoutGrid },
  { key: 'stack', label: 'Continuous Stack', Icon: Rows3 },
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
  onOpenLetsChat,
  layoutMode = 'hub',
  onChangeLayoutMode,
}: LeftNavProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  // Mobile/tablet only (< md) — the icon rail below is hidden and replaced
  // by a hamburger trigger + slide-out drawer holding the same nav items.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Live ISS (disabled) is the only thing left top-level now — everything
  // else (Home/Radio/Studio/Products/Star Tracker/Let's Chat/Ai/Weather/
  // Donate/Preferences) collapses into a single "Home" dropdown (desktop
  // popover / mobile disclosure) to cut down visual clutter in the rail.
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [isMobileHomeExpanded, setIsMobileHomeExpanded] = useState(false);

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
        className={`fixed top-0 left-0 z-50 flex flex-col w-64 max-h-screen gap-6 pt-4 pb-8 overflow-y-auto transition-transform duration-200 border-r border-b bg-neutral-950/85 backdrop-blur-md border-neutral-800 rounded-br-2xl shadow-xl md:hidden ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4">
          <div title="Proto Labs Global">
            <ProtoLabsLogo />
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
          {/* "Home" dropdown — folds Home/Radio/Studio/Products/Star
              Tracker/Let's Chat/Ai/Weather/Donate/Preferences into one
              disclosure so only Live ISS (disabled) stays top-level. */}
          <button
            onClick={() => setIsMobileHomeExpanded((v) => !v)}
            aria-expanded={isMobileHomeExpanded}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="text-sm">Home</span>
            <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${isMobileHomeExpanded ? 'rotate-180' : ''}`} />
          </button>

          {isMobileHomeExpanded && (
            <div className="flex flex-col gap-1 pl-4 border-l ml-5 border-neutral-800">
              {NAV_ITEMS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => handleNavClick(key)}
                  className={`flex items-center gap-3 h-10 px-3 rounded-lg transition-all border ${
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
                  className="flex items-center gap-3 h-10 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  <span className="text-sm">Products</span>
                </button>
              ) : (
                <Link
                  href="/products"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-3 h-10 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
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
                className="relative flex items-center gap-3 h-10 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
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
                  onOpenLetsChat?.();
                }}
                className="flex items-center gap-3 h-10 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">Let&apos;s Chat</span>
              </button>

              <button
                onClick={() => handleHomeViewClick('kali')}
                className="flex items-center gap-3 h-10 px-3 rounded-lg transition-all border border-transparent text-white hover:bg-neutral-900/50"
              >
                <Sparkles className="w-4 h-4 shrink-0 animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                <span className="text-sm">Ai</span>
              </button>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onWeatherClick?.();
                }}
                onDoubleClick={() => {
                  setIsDrawerOpen(false);
                  onWeatherDoubleClick?.();
                }}
                className={`flex items-center gap-3 h-10 px-3 rounded-lg transition-all border border-transparent hover:bg-neutral-900/50 ${
                  weatherActive ? 'text-green-400 hover:text-green-300' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Umbrella className="w-4 h-4 shrink-0" />
                <span className="text-sm">Weather</span>
              </button>

              <DonationButton row />

              <div className="my-1 border-t border-neutral-800" />

              {LAYOUT_MODES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onChangeLayoutMode?.(key);
                  }}
                  className={`flex items-center gap-3 h-10 px-3 rounded-lg transition-all border ${
                    layoutMode === key
                      ? 'bg-neutral-900 text-white border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setShowPreferences(true);
                }}
                className="flex items-center gap-3 h-10 px-3 rounded-lg transition-all text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className="text-sm">Preferences</span>
              </button>
            </div>
          )}

          {/* Live ISS — kept visible per spec but non-interactive
              (pointer-events-none + tabIndex=-1) instead of removed. */}
          <div
            aria-disabled="true"
            tabIndex={-1}
            className="flex items-center gap-3 h-11 px-3 rounded-lg border border-transparent text-neutral-600 opacity-40 pointer-events-none select-none"
          >
            <Satellite className="w-4 h-4 shrink-0" />
            <span className="text-sm">Live ISS</span>
          </div>
        </nav>
      </aside>

      {/* Desktop icon rail (md+) — pb-16 (vs. a plain py-4) keeps the
          Preferences button clear of the bottom-left corner, where Next.js's
          own dev-tools indicator lives in local dev (production has no such
          overlay, but there's no reason to fight it in dev either). */}
      <aside className="relative z-10 hidden flex-col items-center justify-between w-16 min-h-screen pt-4 pb-16 bg-neutral-950/30 backdrop-blur-sm md:flex">
        <div className="flex flex-col items-center gap-6">
          <div title="Proto Labs Global">
            <ProtoLabsLogo />
          </div>

          <nav className="flex flex-col gap-2">
            {/* "Home" dropdown — the single collapsible menu holding every
                folded legacy link (Home/Radio/Studio/Products/Star
                Tracker/Let's Chat/Ai/Weather/Donate/Preferences), leaving
                Live ISS (disabled) as the only other top-level item. Click
                toggles a popover to the right; an invisible full-screen
                backdrop (below) closes it on any outside click. */}
            <div className="relative group">
              <button
                onClick={() => setIsHomeMenuOpen((v) => !v)}
                aria-label="Home menu"
                aria-expanded={isHomeMenuOpen}
                className={`relative z-40 flex items-center justify-center w-10 h-10 rounded transition-all cursor-pointer border ${
                  isHomeMenuOpen
                    ? 'bg-neutral-900 text-white border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-transparent'
                }`}
              >
                <Home className="w-4 h-4" />
              </button>
              {!isHomeMenuOpen && (
                <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                  Home
                </span>
              )}

              {isHomeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsHomeMenuOpen(false)} />
                  <div className="absolute z-40 left-full top-0 ml-2 w-48 py-1.5 rounded-lg border bg-zinc-900/75 backdrop-blur-md border-zinc-800 shadow-xl">
                    {NAV_ITEMS.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        onClick={() => {
                          setIsHomeMenuOpen(false);
                          handleNavClick(key);
                        }}
                        className={`flex items-center w-full gap-3 h-9 px-3 transition-all ${
                          activeTab === key ? 'text-white bg-neutral-800/60' : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-mono">{label}</span>
                      </button>
                    ))}

                    {isStackMode ? (
                      <button
                        onClick={() => {
                          setIsHomeMenuOpen(false);
                          onProductsClick?.();
                        }}
                        className="flex items-center w-full gap-3 px-3 transition-all h-9 text-neutral-300 hover:text-white hover:bg-neutral-800/60"
                      >
                        <LayoutGrid className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-mono">Products</span>
                      </button>
                    ) : (
                      <Link
                        href="/products"
                        onClick={() => setIsHomeMenuOpen(false)}
                        className="flex items-center w-full gap-3 px-3 transition-all h-9 text-neutral-300 hover:text-white hover:bg-neutral-800/60"
                      >
                        <LayoutGrid className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-mono">Products</span>
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        setIsHomeMenuOpen(false);
                        onToggleStarTracker?.();
                      }}
                      className="relative flex items-center w-full gap-3 px-3 transition-all h-9 text-neutral-300 hover:text-white hover:bg-neutral-800/60"
                    >
                      <span className="relative shrink-0">
                        <Telescope className="w-4 h-4" />
                        <span
                          className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${
                            isStarTrackerOpen ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                      </span>
                      <span className="text-xs font-mono">Star Tracker</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsHomeMenuOpen(false);
                        onOpenLetsChat?.();
                      }}
                      className="flex items-center w-full gap-3 px-3 transition-all h-9 text-neutral-300 hover:text-white hover:bg-neutral-800/60"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-mono">Let&apos;s Chat</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsHomeMenuOpen(false);
                        onOpenHomeView?.('kali');
                      }}
                      className="flex items-center w-full gap-3 px-3 text-white transition-all h-9 hover:bg-neutral-800/60"
                    >
                      <Sparkles className="w-4 h-4 shrink-0 animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                      <span className="text-xs font-mono">Ai</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsHomeMenuOpen(false);
                        onWeatherClick?.();
                      }}
                      onDoubleClick={() => {
                        setIsHomeMenuOpen(false);
                        onWeatherDoubleClick?.();
                      }}
                      className={`flex items-center w-full gap-3 px-3 transition-all h-9 hover:bg-neutral-800/60 ${
                        weatherActive ? 'text-green-400 hover:text-green-300' : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      <Umbrella className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-mono">Weather</span>
                    </button>

                    <DonationButton row />

                    <div className="my-1 border-t border-zinc-800" />

                    {LAYOUT_MODES.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        onClick={() => {
                          setIsHomeMenuOpen(false);
                          onChangeLayoutMode?.(key);
                        }}
                        className={`flex items-center w-full gap-3 h-9 px-3 transition-all ${
                          layoutMode === key ? 'text-white bg-neutral-800/60' : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-mono">{label}</span>
                      </button>
                    ))}

                    <div className="my-1 border-t border-zinc-800" />

                    <button
                      onClick={() => {
                        setIsHomeMenuOpen(false);
                        setShowPreferences(true);
                      }}
                      className="flex items-center w-full gap-3 px-3 transition-all h-9 text-neutral-300 hover:text-white hover:bg-neutral-800/60"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-mono">Preferences</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Live ISS — kept visible per spec but non-interactive
                (pointer-events-none + tabIndex=-1) instead of removed. */}
            <div className="relative group">
              <div
                aria-disabled="true"
                aria-label="Live ISS"
                tabIndex={-1}
                className="flex items-center justify-center w-10 h-10 border border-transparent rounded text-neutral-600 opacity-40 pointer-events-none select-none"
              >
                <Satellite className="w-4 h-4" />
              </div>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Live ISS
              </span>
            </div>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3 pt-4 mt-4 border-t border-neutral-900">
          {isAdmin && (
            <span
              title="Admin authorized"
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            />
          )}
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
