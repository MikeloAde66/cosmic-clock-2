'use client';
import { useContextMenuShare } from '@/components/useContextMenuShare';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import TopHeader from '@/components/TopHeader';
import LeftNav from '@/components/LeftNav';
import type { LayoutMode } from '@/components/LayoutModeToggle';
import GalleryGrid from '@/components/GalleryGrid';
import KaliOracleView from '@/components/KaliOracleView';
import ProductsSection from '@/components/ProductsSection';
import TenForwardSection from '@/components/TenForwardSection';
import Reveal from '@/components/Reveal';

// Continuous Stack (Layout 1) mounts Home/Radio/Pods as sibling sections
// (ids stack-section-aione/radio/pods — see the layoutMode === 'stack'
// block below) instead of swapping a single active one. Sidebar nav calls
// this unconditionally on every click regardless of layout mode; it's a
// harmless no-op the rest of the time since those ids only exist in the
// DOM when Stack mode is actually rendered.
function scrollToStackSection(tab: string) {
  document.getElementById(`stack-section-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
import Starfield from '@/components/Starfield';
import FactChecker from '@/components/FactChecker';
import PodsModule from '@/components/PodsModule';
import CosmicVaultAuth from '@/components/CosmicVaultAuth';
import AiOneHome from '@/components/AiOneHome';
import RadioCentralConsoleView from '@/components/radio/RadioCentralConsoleView';
import SiteFooter from '@/components/SiteFooter';
import ISSFeedModal from '@/components/ISSFeedModal';
import StarTrackerView from '@/components/StarTrackerView';
import TriviaView from '@/components/TriviaView';
import VaultSearchModal from '@/components/VaultSearchModal';
import { RadioPlayerProvider } from '@/components/radio/RadioPlayerContext';
import GlobalPlayerBar from '@/components/radio/GlobalPlayerBar';
import { CartProvider } from '@/lib/cart';
import { useWeatherLocation } from '@/lib/useWeatherLocation';
import type { VaultDrawer } from '@/lib/vaultRegistry';

function HomeInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('radio');
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
    scrollToStackSection('aione');
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
  // Set by StarTrackerView's "Ask Kali" tooltip action — a real query built
  // from the live sky-body/telemetry data the user was looking at, handed
  // to whichever AiOneChat instance is actually on screen once openHomeView
  // below switches over to Kali. Prefills the input only; AiOneChat itself
  // decides not to auto-send it.
  const [kaliPrefillQuery, setKaliPrefillQuery] = useState<{ text: string; token: number } | null>(null);
  const askKali = (query: string) => {
    setIsStarTrackerOpen(false);
    setKaliPrefillQuery({ text: query, token: Date.now() });
    openHomeView('kali');
  };
  const openHomeView = (view: 'weather' | 'kali') => {
    setActiveTab('aione');
    setHomeViewRequest({ view, token: Date.now() });
    // Kali has its own standalone Stack section (KaliSection, also used
    // nested inside CosmicCanvas for Hub/Gallery mode) — Weather doesn't,
    // it's persistent footer chrome in every layout, so 'aione' is a
    // harmless fallback there (that scroll call is moot either way since
    // the weather view itself is a no-op inside CosmicCanvas).
    scrollToStackSection(view === 'kali' ? 'kali' : 'aione');
  };

  // Sidebar's Radio/Pods nav items call this (via LeftNav's setActiveTab
  // prop) — in Stack mode there's no "active" tab to swap to, just a
  // section to scroll to; still updates activeTab too so the sidebar's own
  // highlight styling and the Pods mounted-but-hidden logic (Hub mode)
  // keep working unchanged.
  const navigateTab = (tab: string) => {
    setActiveTab(tab);
    scrollToStackSection(tab);
  };

  // Umbrella icon's inline search + footer forecast stream — persistent
  // chrome, not a "home view" like Weather used to be, so it lives here
  // rather than in homeViewRequest and is available on every tab.
  const weather = useWeatherLocation();

  // Layout Toggle feature — 'hub' (default) is the existing tab-swap
  // behavior below, completely unchanged. Persisted across reloads via
  // localStorage (SSR-safe: starts at the 'hub' default, then upgrades
  // once the real stored value is read on mount, same pattern as the
  // weather location's saved-search persistence).
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('hub');
  useEffect(() => {
    const stored = localStorage.getItem('aione_layout_mode');
    if (stored === 'hub' || stored === 'gallery' || stored === 'stack') setLayoutMode(stored);
  }, []);
  const changeLayoutMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem('aione_layout_mode', mode);
  };

  // Floating Back to Top button (Stack mode only) — tracks the Stack
  // layout's own scrollable container (not window.scroll, since the page
  // itself never scrolls; this inner div does).
  const stackScrollRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const handleStackScroll = () => {
    setShowBackToTop((stackScrollRef.current?.scrollTop ?? 0) > 400);
  };

  // Star Tracker / Live ISS — moved out of TopHeader (which used to own
  // both) into LeftNav's icon rail; state lives here now since LeftNav and
  // TopHeader are siblings, and this is also where StarTrackerView/
  // ISSFeedModal are rendered directly rather than from inside TopHeader.
  const [isStarTrackerOpen, setIsStarTrackerOpen] = useState(false);
  const [isIssOpen, setIsIssOpen] = useState(false);
  const [isTriviaOpen, setIsTriviaOpen] = useState(false);
  const [isLetsChatOpen, setIsLetsChatOpen] = useState(false);

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

  // Triggers AiOneHome's Pricing section from TopHeader, now that the
  // Pricing button lives there instead of AiOneHome's own sub-nav — reuses
  // the same pricingRequestToken mechanism Stripe's cancel_url already
  // drives above.
  const openPricing = () => {
    setActiveTab('aione');
    setPricingRequestToken(Date.now());
  };

  return (
    <RadioPlayerProvider>
    <CartProvider>
      {/* Edge-to-edge at every viewport size — small screens use the real
          device width/height now that the internal layout (sidebar drawer,
          collapsible header pills, single-column grids) is genuinely
          responsive, rather than being shrunk into a fake phone-mockup
          bezel. */}
      <div className="w-screen h-screen bg-black">
        <main className="relative flex w-screen h-screen overflow-hidden bg-[#0a0a0c]">
        <Starfield />
        <LeftNav
          activeTab={activeTab}
          setActiveTab={navigateTab}
          onUnlockVault={unlockVault}
          onOpenVaultForOwner={openVaultForOwner}
          onOpenHomeView={openHomeView}
          onGroundZero={goToGroundZero}
          onWeatherClick={weather.toggleSearch}
          onWeatherDoubleClick={weather.quickView}
          weatherActive={weather.weatherActive}
          isStackMode={layoutMode === 'stack'}
          onProductsClick={() => scrollToStackSection('products')}
          isStarTrackerOpen={isStarTrackerOpen}
          onToggleStarTracker={() => setIsStarTrackerOpen((v) => !v)}
          onOpenLiveIss={() => setIsIssOpen(true)}
          onOpenTrivia={() => setIsTriviaOpen(true)}
          onOpenLetsChat={() => setIsLetsChatOpen(true)}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TopHeader
            activeTab={activeTab}
            onOpenPricing={openPricing}
            layoutMode={layoutMode}
            onLayoutModeChange={changeLayoutMode}
          />

          {/* Classic Hub (default, unchanged) — the existing tab-swap
              behavior below, exactly as it's always worked. Gallery/Stack
              are being built one at a time per the agreed pacing; this
              round only wires up the toggle + persistence + an honest
              placeholder for the other two modes, not their real layouts
              yet. */}
          {layoutMode === 'hub' && (
            <div className="relative flex-1 overflow-hidden">
              {activeTab === 'radio' && <RadioCentralConsoleView />}

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
                  kaliPrefillQuery={kaliPrefillQuery}
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
          )}

          {layoutMode === 'gallery' && (
            <div className="relative flex-1 overflow-hidden">
              <GalleryGrid
                onOpenRadio={() => {
                  setActiveTab('radio');
                  changeLayoutMode('hub');
                }}
                onOpenPods={() => {
                  setActiveTab('pods');
                  changeLayoutMode('hub');
                }}
                onOpenKali={() => {
                  changeLayoutMode('hub');
                  openHomeView('kali');
                }}
                onWeatherClick={weather.toggleSearch}
                weatherActive={weather.weatherActive}
              />
            </div>
          )}

          {/* Continuous Stack (Layout 1) — Home/Radio/Pods/Products/Kali
              mounted together as sibling sections in one scrollable
              container, rather than one active tab swapping inside it.
              Each is min-h-full (at least the height a single Hub-mode view
              would get, more if its real content needs it) so scrolling
              from one to the next lands cleanly at its top, with a visible
              border-t divider and each section's own internal padding
              (Radio/Pods' existing headers, Products' py-16, Kali's p-4)
              keeping content from crowding across the seam. Sidebar nav
              (via navigateTab/goToGroundZero/openHomeView above) scrolls
              here by id instead of switching activeTab.
              Vault deliberately isn't a stacked section — it's
              access-gated and never a public nav destination (see
              LeftNav's NAV_ITEMS comment) — and Weather stays persistent
              footer chrome exactly as in every other layout mode, not a
              section of its own. Products is real product data (not the
              literal /products route component — see ProductsSection.tsx
              for why) and Kali is now a genuine standalone section
              (KaliSection.tsx, extracted out of CosmicCanvas so Hub/Gallery
              mode's nested Kali sub-view can share the same component). */}
          {layoutMode === 'stack' && (
            <div ref={stackScrollRef} onScroll={handleStackScroll} className="relative flex-1 overflow-y-auto">
              <div id="stack-section-aione" className="w-full min-h-full">
                <Reveal className="w-full h-full">
                  <AiOneHome
                    onNavigateToVaultDrawer={navigateToVaultDrawer}
                    homeViewRequest={homeViewRequest}
                    groundZeroToken={groundZeroToken}
                    pricingRequestToken={pricingRequestToken}
                    kaliPrefillQuery={kaliPrefillQuery}
                  />
                </Reveal>
              </div>
              <div id="stack-section-radio" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal className="w-full h-full">
                  <RadioCentralConsoleView />
                </Reveal>
              </div>
              <div id="stack-section-pods" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal className="w-full h-full">
                  <PodsModule isActive />
                </Reveal>
              </div>
              <div id="stack-section-products" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal>
                  <ProductsSection />
                </Reveal>
              </div>
              <div id="stack-section-kali" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal className="w-full h-full">
                  <KaliOracleView prefillQuery={kaliPrefillQuery} />
                </Reveal>
              </div>
              <div id="stack-section-tenforward" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal>
                  <TenForwardSection />
                </Reveal>
              </div>

            </div>
          )}

          {/* Floating Back to Top — appears once the Stack layout's own
              scroll container (not the window) has been scrolled past the
              hero; fixed to the viewport corner, offset above
              GlobalPlayerBar + SiteFooter's combined height so it doesn't
              sit on top of them. */}
          {layoutMode === 'stack' && showBackToTop && (
            <button
              onClick={() => scrollToStackSection('aione')}
              aria-label="Back to top"
              className="fixed z-30 flex items-center justify-center w-10 h-10 transition-all border rounded-full shadow-lg cursor-pointer bottom-28 right-6 bg-neutral-900/90 border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 backdrop-blur-sm"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}

          {/* Always mounted above SiteFooter, on every tab, from initial
              page load — shows an idle/paused strip until a station is
              picked, per GlobalPlayerBar's own idle-state rendering. Star
              Tracker and /products need no extra handling here: Star
              Tracker is a fixed z-50 overlay that already covers this bar
              (z-10) whenever it's open, and /products is a fully separate
              Next.js route that never renders this tree at all. */}
          <GlobalPlayerBar />
          <SiteFooter
            weatherSearchOpen={weather.searchOpen}
            weatherLoading={weather.loading}
            weatherError={weather.error}
            weatherForecastText={weather.forecastText}
            weatherCurrentTemp={weather.currentTemp}
            onWeatherSubmit={weather.submitLocation}
          />
        </div>
        </main>
      </div>

      <VaultSearchModal
        isOpen={isVaultSearchOpen}
        onClose={() => setIsVaultSearchOpen(false)}
        onNavigateToVaultDrawer={navigateToVaultDrawer}
      />

      {/* ISS Stream Modal + Star Tracker — both moved here from TopHeader,
          now triggered from LeftNav instead. Star Tracker is a dedicated
          full-screen view (fixed z-50), not a stacked modal. */}
      <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />
      {isStarTrackerOpen && <StarTrackerView onBack={() => setIsStarTrackerOpen(false)} onAskKali={askKali} />}
      {isTriviaOpen && <TriviaView onBack={() => setIsTriviaOpen(false)} />}
      {isLetsChatOpen && <TenForwardSection onBack={() => setIsLetsChatOpen(false)} />}
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