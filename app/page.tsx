'use client';
import { useContextMenuShare } from '@/components/useContextMenuShare';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopHeader from '@/components/TopHeader';
import LeftNav from '@/components/LeftNav';
import Starfield from '@/components/Starfield';
import FactChecker from '@/components/FactChecker';
import PodsModule from '@/components/PodsModule';
import CosmicVaultAuth from '@/components/CosmicVaultAuth';
import AiOneHome from '@/components/AiOneHome';
import RadioStreams from '@/components/RadioStreams';
import SiteFooter from '@/components/SiteFooter';
import VaultSearchModal from '@/components/VaultSearchModal';
import { RadioPlayerProvider } from '@/components/radio/RadioPlayerContext';
import GlobalPlayerBar from '@/components/radio/GlobalPlayerBar';
import { CartProvider } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionStatus } from '@/lib/subscriptionStatus';
import type { VaultDrawer } from '@/lib/vaultRegistry';

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('aione');
  // Set by a Home globe Vault marker's "Open Drawer" link, or a Cmd+K search
  // result, consumed once as CosmicVaultAuth's initial filter — see that
  // component's initialDrawer prop.
  const [pendingVaultDrawer, setPendingVaultDrawer] = useState<VaultDrawer | null>(null);
  const navigateToVaultDrawer = (drawer: VaultDrawer) => {
    setPendingVaultDrawer(drawer);
    setActiveTab('vault');
  };

  // Bumped by LeftNav's Home icon — the one dedicated "ground zero" return
  // path now that Weather/Kali no longer have their own Back buttons. A
  // token (not a boolean) so clicking Home while already on the clock view
  // is still a no-op-safe signal AiOneHome/CosmicCanvas can react to every
  // time, the same pattern homeViewRequest below already uses.
  const [groundZeroToken, setGroundZeroToken] = useState(0);
  const goToGroundZero = () => {
    setActiveTab('aione');
    setGroundZeroToken(Date.now());
  };

  // Set by LeftNav's Preferences modal — the only remaining front door into
  // the Vault now that its sidebar button is gone. Handed to CosmicVaultAuth
  // as initialRoleKey, which still does its own real verification; this
  // just gets the user there.
  const [pendingVaultKey, setPendingVaultKey] = useState<string | null>(null);
  const unlockVault = (roleKey: string) => {
    setPendingVaultKey(roleKey);
    setActiveTab('vault');
  };
  // Owner Vault Access Rule: no key needed at all — CosmicVaultAuth
  // independently confirms the real Supabase admin session and unlocks
  // itself the moment it mounts, so this is just navigation.
  const openVaultForOwner = () => {
    setActiveTab('vault');
  };

  // Set by LeftNav's Weather/Kali Yuga icons — replaces the pill buttons
  // that used to float over the 3D Earth canvas. A token (not just the view
  // name) so clicking the same icon twice in a row still re-triggers the
  // effect that opens it inside CosmicCanvas, which stays mounted between
  // clicks.
  const [homeViewRequest, setHomeViewRequest] = useState<{ view: 'weather' | 'kali'; token: number } | null>(null);
  const openHomeView = (view: 'weather' | 'kali') => {
    setActiveTab('aione');
    setHomeViewRequest({ view, token: Date.now() });
  };

  const [isVaultSearchOpen, setIsVaultSearchOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsVaultSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
useContextMenuShare();

  // Smart Auth & Access Guard: a signed-in visitor with a real active
  // subscription skips the landing page entirely. Runs silently in the
  // background rather than gating the initial render — the common case
  // (an unauthenticated visitor) shouldn't wait on an auth round-trip just
  // to see the landing page it was already about to show.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) return;
      const status = await checkSubscriptionStatus(user.id);
      if (!cancelled && status.active) router.replace('/dashboard');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // /dashboard's "Radio Broadcast Hub" link, and Stripe's cancel_url /
  // dashboard's required-plan redirect, land back here with a query param
  // rather than app state — read it once on mount and translate it into
  // this component's own existing state (activeTab / the Pricing section).
  const [pricingRequestToken, setPricingRequestToken] = useState(0);
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'radio') setActiveTab('radio');

    const checkout = searchParams.get('checkout');
    if (checkout === 'cancelled' || checkout === 'required') {
      setActiveTab('aione');
      setPricingRequestToken(Date.now());
    }
    // Only ever consumed once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <RadioPlayerProvider>
    <CartProvider>
      {/* Responsive app frame: a real desktop viewport gets the app
          edge-to-edge as before (this wrapper is `contents` at sm+, i.e.
          invisible to layout); a small screen instead gets the same app
          inside a framed mobile-device shell, centered on a plain
          backdrop. */}
      <div className="flex items-center justify-center w-screen h-screen bg-black sm:contents">
        <main className="relative flex w-screen h-screen overflow-hidden bg-[#0a0a0c] max-sm:h-[92vh] max-sm:max-w-sm max-sm:rounded-[40px] max-sm:border-[6px] max-sm:border-neutral-800 max-sm:shadow-2xl">
        <Starfield />
        <LeftNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onUnlockVault={unlockVault}
          onOpenVaultForOwner={openVaultForOwner}
          onOpenHomeView={openHomeView}
          onGroundZero={goToGroundZero}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TopHeader activeTab={activeTab} />

          <div className="relative flex-1 overflow-hidden">
            {activeTab === 'radio' && <RadioStreams />}

            {activeTab === 'vault' && (
              <CosmicVaultAuth
                initialDrawer={pendingVaultDrawer ?? undefined}
                initialRoleKey={pendingVaultKey ?? undefined}
              />
            )}

            {activeTab === 'aione' && (
              <AiOneHome
                onNavigateToVaultDrawer={navigateToVaultDrawer}
                homeViewRequest={homeViewRequest}
                groundZeroToken={groundZeroToken}
                pricingRequestToken={pricingRequestToken}
              />
            )}

            {activeTab === 'fact-checker' && (
              <div className="w-full h-full p-6 overflow-auto">
                <FactChecker />
              </div>
            )}

            {/* Pods stays mounted (just hidden) instead of unmounting on tab
                switch — it holds local file uploads as in-memory blob URLs,
                which die the instant the component unmounts. Unlike a real
                page reload (where blob URLs are gone regardless), switching
                tabs within this single-page app doesn't need to destroy them. */}
            <div className={activeTab === 'pods' ? 'w-full h-full' : 'hidden'}>
              <PodsModule isActive={activeTab === 'pods'} />
            </div>
          </div>

          {/* Always mounted (renders nothing until a station is playing) so
              radio playback survives switching tabs, not scoped to the Radio
              tab's own lifecycle the way everything but Pods currently is. */}
          <GlobalPlayerBar />
          <SiteFooter />
        </div>
        </main>
      </div>

      <VaultSearchModal
        isOpen={isVaultSearchOpen}
        onClose={() => setIsVaultSearchOpen(false)}
        onNavigateToVaultDrawer={navigateToVaultDrawer}
      />
    </CartProvider>
    </RadioPlayerProvider>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}