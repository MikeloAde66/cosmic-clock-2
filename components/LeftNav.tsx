'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Home, Menu, Settings, X as CloseIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PreferencesModal from './PreferencesModal';
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
  // button, so this is now the only way out of them. "Project" below is
  // this same ground-zero action, just relabeled per the nav strip-down.
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
  // Star Tracker — a real on/off toggle (green dot open, red dot closed).
  isStarTrackerOpen?: boolean;
  onToggleStarTracker?: () => void;
  // Opens the dedicated "Let's Chat" community view (TenForwardSection).
  onOpenLetsChat?: () => void;
  // Classic Hub / Gallery Grid / Continuous Stack layout mode.
  layoutMode?: LayoutMode;
  onChangeLayoutMode?: (mode: LayoutMode) => void;
}

// Stripped down per the "clean this site up" nav restructure — Radio
// Central, Studio One, Products, Star Tracker PRO, Media Center, Ai,
// Weather, Donate, and the layout-mode toggles all moved out of this nav
// entirely. Every one of those destinations is still reachable from the
// Home dashboard's own card grid, so nothing becomes unreachable — this is
// just no longer the place to find them. Only three things stay: Project
// (ground zero / the main dashboard), Billing (the real paywall — Stripe's
// customer portal via /billing), and Preferences (kept for security: Vault
// access and admin-only controls live there).
export default function LeftNav({
  onUnlockVault,
  onOpenVaultForOwner,
  onGroundZero,
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

  const handleProjectClick = () => {
    setIsDrawerOpen(false);
    onGroundZero?.();
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
          <button
            onClick={handleProjectClick}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="text-sm">Project</span>
          </button>

          <Link
            href="/billing"
            onClick={() => setIsDrawerOpen(false)}
            className="flex items-center gap-3 h-11 px-3 rounded-lg transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="text-sm">Billing</span>
          </Link>

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
          own dev-tools indicator lives in local dev. */}
      <aside className="relative z-10 hidden flex-col items-center justify-between w-16 min-h-screen pt-4 pb-16 bg-neutral-950/30 backdrop-blur-sm md:flex">
        <div className="flex flex-col items-center gap-6">
          <div title="Proto Labs Global">
            <ProtoLabsLogo />
          </div>

          <nav className="flex flex-col gap-2">
            <div className="relative group">
              <button
                onClick={handleProjectClick}
                aria-label="Project"
                className="flex items-center justify-center w-10 h-10 rounded transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Home className="w-4 h-4" />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Project
              </span>
            </div>

            <div className="relative group">
              <Link
                href="/billing"
                aria-label="Billing"
                className="flex items-center justify-center w-10 h-10 rounded transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <CreditCard className="w-4 h-4" />
              </Link>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Billing
              </span>
            </div>

            <div className="relative group">
              <button
                onClick={() => setShowPreferences(true)}
                aria-label="Preferences"
                className="flex items-center justify-center w-10 h-10 rounded transition-all border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              >
                <Settings className="w-4 h-4" />
              </button>
              <span className="absolute z-20 px-2.5 py-1 ml-2 text-xs font-mono transition-opacity duration-150 -translate-y-1/2 rounded-md opacity-0 pointer-events-none left-full top-1/2 whitespace-nowrap bg-zinc-900/90 border border-zinc-800 text-white group-hover:opacity-100">
                Preferences
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
