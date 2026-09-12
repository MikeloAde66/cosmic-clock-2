'use client';
import { useContextMenuShare } from '@/components/useContextMenuShare';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import TopHeader from '@/components/TopHeader';
import AuthModal from '@/components/AuthModal';
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
import PodsModule, { type StudioOneHandoffTrack } from '@/components/PodsModule';
import CosmicVaultAuth from '@/components/CosmicVaultAuth';
import AiOneHome from '@/components/AiOneHome';
import RadioCentralConsoleView from '@/components/radio/RadioCentralConsoleView';
import SiteFooter from '@/components/SiteFooter';
import ISSFeedModal from '@/components/ISSFeedModal';
import StarTrackerView from '@/components/StarTrackerView';
import StarTrackerProBackground from '@/components/starTrackerPro/StarTrackerProBackground';
import VaultSearchModal from '@/components/VaultSearchModal';
import { useRadioPlayer } from '@/components/radio/RadioPlayerContext';
import { CartProvider } from '@/lib/cart';
import { useWeatherLocation } from '@/lib/useWeatherLocation';
import type { VaultDrawer } from '@/lib/vaultRegistry';

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Radio Central is a real bare standalone route (/radio) now, not a Hub
  // tab — 'aione' (the Home hero) is the sane Hub-mode fallback in its
  // place. Its old Hub-tab render below is gone; Continuous Stack mode's
  // own inline Radio section (further down) is untouched, since that's a
  // deliberate, separately opted-into "everything on one page" layout.
  const [activeTab, setActiveTab] = useState<string>('aione');
  // GlobalPlayerBar now mounts globally in app/layout.tsx, above every
  // route — this is the one remaining way this specific tab can still hide
  // it while Pods/Studio One (a video-only workspace) is active. Cleanup
  // resets it on unmount so navigating away from '/' entirely (e.g. to
  // /products) never leaves the bar stuck hidden.
  const { setPlayerBarHidden } = useRadioPlayer();
  // Mirrors AiOneHome/CenterHero/CosmicCanvas's own activeView — 'clock'
  // unless the Kali Oracle sub-view is actually open.
  const [cosmicView, setCosmicView] = useState<'clock' | 'weather' | 'kali'>('clock');
  // Shared by TopHeader's Pricing button and SiteFooter (Earth Time/Kali
  // Yuga/social links) — Kali and Studio One are both focused, full-screen
  // workspaces where that chrome is just clutter eating into real vertical
  // space, especially on mobile. Independent of showBottomChrome below,
  // which is specifically about GlobalPlayerBar (see RadioPlayerContext) —
  // the two used to be the same boolean, but the player bar's visibility
  // rule is now scoped to Radio Central/Media Flow only, not "every view
  // except Pods/Kali".
  const hideBottomChrome = activeTab === 'pods' || (activeTab === 'aione' && cosmicView === 'kali');
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
  // AiOneHome/KaliOracleView/AiOneChat's own prefillQuery props are still
  // real, generic, reusable infrastructure — but the one thing that ever
  // populated it at this app/page.tsx level was the legacy StarTrackerView's
  // "Ask Kali" tooltip (askKali()), which has no equivalent yet in the
  // Phase 1 rewrite (see StarTrackerProCanvas). Removed the now-write-less
  // state itself rather than keep threading a permanently-null value
  // through three components; a future phase that reintroduces Kali
  // integration can add a real writer back here.
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

  // Layout Toggle feature — 'gallery' is the deliberate, deterministic
  // landing view for '/' on every load. This used to persist across
  // reloads via localStorage, but that meant the *first* time anyone ever
  // clicked into Hub mode (which every Gallery card that isn't Products
  // does, to land on its feature), 'hub' got written and then silently
  // overrode this default forever after — on every future visit, root
  // would flash the gallery cards for a moment (first paint, this default)
  // and then flip straight to whatever Hub tab was last open. Switching
  // layout modes within a single visit still works instantly via
  // changeLayoutMode below; it just doesn't survive a hard refresh anymore.
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('gallery');
  const changeLayoutMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
  };

  // Floating Back to Top button (Stack mode only) — tracks the Stack
  // layout's own scrollable container (not window.scroll, since the page
  // itself never scrolls; this inner div does).
  const stackScrollRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const handleStackScroll = () => {
    setShowBackToTop((stackScrollRef.current?.scrollTop ?? 0) > 400);
  };

  // GlobalPlayerBar is scoped to Home, Radio Central, and Media Flow (see
  // RadioPlayerContext's playerBarHidden default). In Stack mode all three
  // live as inline sections alongside Pods/Products/Kali on one continuous
  // scroll, so "is one of those the active view" has to mean "is that
  // section actually scrolled into view" — tracked here via a real
  // IntersectionObserver against Stack's own scroll container, not window
  // scroll (see stackScrollRef above).
  const aioneSectionRef = useRef<HTMLDivElement>(null);
  const radioSectionRef = useRef<HTMLDivElement>(null);
  const tenForwardSectionRef = useRef<HTMLDivElement>(null);
  const [stackChromeSectionVisible, setStackChromeSectionVisible] = useState(false);
  useEffect(() => {
    if (layoutMode !== 'stack') {
      setStackChromeSectionVisible(false);
      return;
    }
    const targets = [aioneSectionRef.current, radioSectionRef.current, tenForwardSectionRef.current].filter(
      (el): el is HTMLDivElement => el !== null
    );
    if (targets.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setStackChromeSectionVisible(visible.size > 0);
      },
      { root: stackScrollRef.current, threshold: 0.4 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [layoutMode]);

  // Star Tracker / Live ISS — moved out of TopHeader (which used to own
  // both) into LeftNav's icon rail; state lives here now since LeftNav and
  // TopHeader are siblings, and this is also where StarTrackerView/
  // ISSFeedModal are rendered directly rather than from inside TopHeader.
  // Defaults to false — the main Ai One dashboard (hub grid: GalleryGrid,
  // Radio Central, Studio One, Weather, Kali, etc.) is the landing view,
  // per explicit request reverting the earlier Star-Tracker-as-default
  // choice: the gateway link from protolabsglobal-main-shell's "Open Kali
  // AI" button points at this same root domain, and should land visitors
  // on the dashboard, not straight into Star Tracker PRO. Nothing about
  // the route/layout structure changes — Star Tracker PRO is still one
  // click away via LeftNav's own toggle.
  const [isStarTrackerOpen, setIsStarTrackerOpen] = useState(false);
  const [isIssOpen, setIsIssOpen] = useState(false);
  const [isLetsChatOpen, setIsLetsChatOpen] = useState(false);
  // The things allowed to show GlobalPlayerBar within this SPA route: the
  // Media Flow overlay (isLetsChatOpen), the Ai One Home view itself
  // (Gallery mode's grid, or Hub mode's 'aione' tab) as long as Star
  // Tracker isn't open on top of it, or Stack mode's Home/Radio Central/
  // Media Flow sections while actually scrolled into view (see
  // stackChromeSectionVisible above). Radio Central's other home, the
  // standalone /radio route, opts in independently since it never mounts
  // this component at all.
  const isHomeVisible = !isStarTrackerOpen && (layoutMode === 'gallery' || (layoutMode === 'hub' && activeTab === 'aione'));
  const showBottomChrome = isLetsChatOpen || isHomeVisible || stackChromeSectionVisible;
  useEffect(() => {
    setPlayerBarHidden(!showBottomChrome);
    return () => setPlayerBarHidden(true);
  }, [showBottomChrome, setPlayerBarHidden]);
  // "Send to Studio One" hand-off from Media Flow — lifted here since
  // PodsModule has no shared context of its own (unlike Radio Central's
  // RadioPlayerContext) for MediaFlowAudioCenter to call into directly.
  // Cleared by PodsModule itself via onPendingTrackConsumed once applied.
  const [pendingStudioOneTrack, setPendingStudioOneTrack] = useState<StudioOneHandoffTrack | null>(null);
  const handleSendToStudioOne = (track: StudioOneHandoffTrack) => {
    setPendingStudioOneTrack(track);
    setIsLetsChatOpen(false);
    setActiveTab('pods');
    changeLayoutMode('hub');
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

  // /dashboard's "Radio Broadcast Hub" link, and Stripe's cancel_url /
  // dashboard's required-plan redirect, land back here with a query param
  // rather than app state — read it once on mount and translate it into
  // this component's own existing state (activeTab / the Pricing section).
  const [pricingRequestToken, setPricingRequestToken] = useState(0);
  // ?auth=login / ?auth=signup — the deep-link the protolabsglobal-main-shell
  // static site's Log In/Sign Up buttons point at, so clicking them opens
  // this real modal directly on arrival instead of requiring an extra click
  // once here. A token (not just the mode) so the same mode requested twice
  // in a row (rare, but e.g. a second click before this state clears) still
  // re-triggers the open.
  const [authModalRequest, setAuthModalRequest] = useState<{ mode: 'login' | 'signup'; token: number } | null>(null);
  useEffect(() => {
    // Radio Central moved to its own standalone route — an old ?tab=radio
    // link should land there instead of a now-nonexistent Hub tab.
    if (searchParams.get('tab') === 'radio') {
      router.replace('/radio');
      return;
    }

    const checkout = searchParams.get('checkout');
    if (checkout === 'cancelled' || checkout === 'required') {
      setActiveTab('aione');
      setPricingRequestToken(Date.now());
    }

    const auth = searchParams.get('auth');
    if (auth === 'login' || auth === 'signup') {
      setAuthModalRequest({ mode: auth, token: Date.now() });
    }

    // ?view=kali — real deep-link for external sites (e.g. the
    // protolabsglobal-main-shell static site's Kali AI card) to land
    // directly on the Kali chat section instead of the default tab.
    if (searchParams.get('view') === 'kali') {
      openHomeView('kali');
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

  // ?embed=1&auth=login (or signup) — used when this page is loaded inside
  // an <iframe> from the protolabsglobal-main-shell static site's own
  // modal overlay. Renders just the real auth modal, nothing else (no
  // LeftNav/TopHeader/app chrome), so the iframe shows only the modal
  // itself. Posts a message to the parent window on close/real sign-in so
  // the shell can dismiss its overlay too — real cross-window
  // communication, not a guess at timing.
  if (searchParams.get('embed') === '1' && authModalRequest) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-transparent">
        <AuthModal
          isOpen
          initialMode={authModalRequest.mode}
          onClose={() => {
            if (window.parent !== window) {
              window.parent.postMessage({ type: 'cosmic-auth-closed' }, '*');
            }
          }}
        />
      </div>
    );
  }

  return (
    <CartProvider>
      {/* Edge-to-edge at every viewport size — small screens use the real
          device width/height now that the internal layout (sidebar drawer,
          collapsible header pills, single-column grids) is genuinely
          responsive, rather than being shrunk into a fake phone-mockup
          bezel. */}
      {/* h-dvh (dynamic viewport height), not h-screen (100vh) - on iOS
          Safari, 100vh includes the space behind the address bar even
          when it's actually showing, so the real visible area is
          shorter than h-screen claims. dvh tracks the real visible
          height as the browser chrome shows/hides; identical to vh on
          desktop, where there's no such chrome to account for. */}
      <div className="w-screen h-dvh bg-black">
        <main className="relative flex w-screen h-dvh overflow-hidden bg-[#0a0a0c]">
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
          onOpenLetsChat={() => setIsLetsChatOpen(true)}
          layoutMode={layoutMode}
          onChangeLayoutMode={changeLayoutMode}
        />

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <TopHeader
            activeTab={activeTab}
            onOpenPricing={openPricing}
            authModalRequest={authModalRequest}
            hidePricing={hideBottomChrome}
          />

          {/* Classic Hub (default, unchanged) — the existing tab-swap
              behavior below, exactly as it's always worked. Gallery/Stack
              are being built one at a time per the agreed pacing; this
              round only wires up the toggle + persistence + an honest
              placeholder for the other two modes, not their real layouts
              yet. */}
          {layoutMode === 'hub' && (
            <div className="relative flex-1 overflow-hidden">
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
                  onCosmicViewChange={setCosmicView}
                  onGoHome={() => changeLayoutMode('gallery')}
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
                  tabs within this single-page app doesn't need to destroy them.
                  overflow-y-auto - confirmed body.scrollHeight === body.
                  clientHeight (no scroll at all) on mobile, and PodsModule's
                  own Studio One console has no page-level scroll of its own
                  (only a small max-h-56 track-list sub-scroll) - its real
                  content can be taller than this wrapper's fixed h-full
                  allocation, and the ancestor chain up to app/page.tsx's own
                  hub-mode wrapper is overflow-hidden the whole way, so that
                  excess was completely unreachable. */}
              <div className={activeTab === 'pods' ? 'w-full h-full overflow-y-auto' : 'hidden'}>
                {/* Standalone, outer-level back button — deliberately NOT
                    routed through PodsModule's own onGoHome prop or any
                    nested callback chain. Calls changeLayoutMode('gallery')
                    directly, in normal document flow above PodsModule's
                    own header (not fixed/absolute), so it can't collide
                    with LeftNav's fixed mobile hamburger trigger
                    (top-3 left-3) regardless of viewport size. This is in
                    addition to, not a replacement for, PodsModule's own
                    Home button — both call the same real function. */}
                {activeTab === 'pods' && (
                  <div className="p-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeLayoutMode('gallery')}
                      className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
                    >
                      &laquo; Main Console
                    </button>
                  </div>
                )}
                {/* changeLayoutMode('gallery'), not setActiveTab('aione') —
                    "Home" from Studio One means the actual 9-card
                    dashboard grid (Radio Central/Studio One/Star
                    Tracker/Products), not AiOneHome's own hero/clock
                    view within Hub mode. setActiveTab alone left the
                    user stuck in Hub mode looking at that hero view
                    instead, which is what was being reported as "the
                    blank landing view with the PRICING header." */}
                <PodsModule
                  isActive={activeTab === 'pods'}
                  onGoHome={() => changeLayoutMode('gallery')}
                  pendingTrack={pendingStudioOneTrack}
                  onPendingTrackConsumed={() => setPendingStudioOneTrack(null)}
                />
              </div>
            </div>
          )}

          {layoutMode === 'gallery' && (
            // min-h-0 overrides flexbox's default min-height:auto on a
            // flex-1 child — without it, this wrapper (and the h-screen
            // chain above it) refuses to actually shrink to the space
            // it's allocated, so GalleryGrid's own content pushes past
            // the visible viewport instead of scrolling inside its own
            // overflow-y-auto. That's what was shoving the reserved
            // spacer + SiteFooter down behind the fixed-position
            // GlobalPlayerBar, making the footer's social icons
            // unreachable on real (non-tiny) viewport heights.
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <GalleryGrid
                onOpenRadio={() => router.push('/radio')}
                onOpenPods={() => {
                  setActiveTab('pods');
                  changeLayoutMode('hub');
                }}
                onOpenKali={() => {
                  changeLayoutMode('hub');
                  openHomeView('kali');
                }}
                onOpenStarTracker={() => setIsStarTrackerOpen(true)}
                onOpenLetsChat={() => setIsLetsChatOpen(true)}
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
              <div id="stack-section-aione" ref={aioneSectionRef} className="w-full min-h-full">
                <Reveal className="w-full h-full">
                  <AiOneHome
                    onNavigateToVaultDrawer={navigateToVaultDrawer}
                    homeViewRequest={homeViewRequest}
                    groundZeroToken={groundZeroToken}
                    pricingRequestToken={pricingRequestToken}
                    />
                </Reveal>
              </div>
              <div id="stack-section-radio" ref={radioSectionRef} className="w-full min-h-full border-t border-slate-800/80">
                <Reveal className="w-full h-full">
                  <RadioCentralConsoleView />
                </Reveal>
              </div>
              <div id="stack-section-pods" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal className="w-full h-full">
                  <PodsModule
                    isActive
                    pendingTrack={pendingStudioOneTrack}
                    onPendingTrackConsumed={() => setPendingStudioOneTrack(null)}
                  />
                </Reveal>
              </div>
              <div id="stack-section-products" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal>
                  <ProductsSection />
                </Reveal>
              </div>
              <div id="stack-section-kali" className="w-full min-h-full border-t border-slate-800/80">
                <Reveal className="w-full h-full">
                  <KaliOracleView />
                </Reveal>
              </div>
              <div id="stack-section-tenforward" ref={tenForwardSectionRef} className="w-full min-h-full border-t border-slate-800/80">
                <Reveal>
                  <TenForwardSection onSendToStudioOne={handleSendToStudioOne} />
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

          {/* Earth Time / Kali Yuga / social links — same hideBottomChrome
              as the audio player and Pricing button, for the same reason:
              Kali and Studio One are focused, full-screen workspaces where
              this is clutter eating into real vertical space on mobile. */}
          {!hideBottomChrome && (
            <SiteFooter
              weatherSearchOpen={weather.searchOpen}
              weatherLoading={weather.loading}
              weatherError={weather.error}
              weatherForecastText={weather.forecastText}
              weatherCurrentTemp={weather.currentTemp}
              onWeatherSubmit={weather.submitLocation}
            />
          )}
          {/* GlobalPlayerBar itself now mounts globally in app/layout.tsx
              as a fixed-to-viewport overlay, shown only while showBottomChrome
              is true (Media Flow open, or Stack mode scrolled to its Radio
              Central/Media Flow section — see the effect above). This spacer
              reserves the same h-14 of room at the very bottom of the flex
              column so SiteFooter isn't covered by it whenever it's actually
              rendering — it has to come AFTER SiteFooter (not before) to
              actually push the footer up above where the fixed bar sits;
              placed before it instead just pushed SiteFooter down into that
              exact region, which is what was covering the footer's own
              social icons. */}
          {showBottomChrome && <div className="h-14 shrink-0" />}
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
          full-screen view (fixed z-50), not a stacked modal. Reverted from
          the Phase 1 WebGL/R3F StarTrackerProCanvas back to the legacy
          StarTrackerView here — that's the actual dashboard (Messier dome,
          telemetry header, Sky Fest) requested as the hub's default view.
          StarTrackerView's own root is transparent/pointer-events-none by
          design (see that component) — it's built to be a HUD layered
          over StarTrackerProBackground's WebGL starfield, the same pairing
          the standalone /star-tracker route already uses, not a
          self-contained opaque view on its own; mounting it without that
          background here would let the hub grid bleed through underneath.
          onAskKali omitted, same as that standalone route — no real "hand
          off to Kali chat" integration point exists at this call site yet. */}
      <ISSFeedModal isOpen={isIssOpen} onClose={() => setIsIssOpen(false)} />
      {isStarTrackerOpen && (
        <div className="fixed inset-0 z-50 w-full h-screen overflow-hidden bg-black">
          <StarTrackerProBackground />
          <StarTrackerView onBack={() => setIsStarTrackerOpen(false)} />
        </div>
      )}
      {isLetsChatOpen && (
        <TenForwardSection onBack={() => setIsLetsChatOpen(false)} onSendToStudioOne={handleSendToStudioOne} />
      )}
    </CartProvider>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}