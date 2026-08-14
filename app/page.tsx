'use client';
import { useContextMenuShare } from '@/components/useContextMenuShare';
import React, { useEffect, useState } from 'react';
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
import type { VaultDrawer } from '@/lib/vaultRegistry';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('aione');
  // Set by a Home globe Vault marker's "Open Drawer" link, or a Cmd+K search
  // result, consumed once as CosmicVaultAuth's initial filter — see that
  // component's initialDrawer prop.
  const [pendingVaultDrawer, setPendingVaultDrawer] = useState<VaultDrawer | null>(null);
  const navigateToVaultDrawer = (drawer: VaultDrawer) => {
    setPendingVaultDrawer(drawer);
    setActiveTab('vault');
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
  return (
    <RadioPlayerProvider>
      <main className="relative flex h-screen w-screen overflow-hidden bg-[#0a0a0c]">
        <Starfield />
        <LeftNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TopHeader activeTab={activeTab} />

          <div className="relative flex-1 overflow-hidden">
            {activeTab === 'radio' && <RadioStreams />}

            {activeTab === 'vault' && <CosmicVaultAuth initialDrawer={pendingVaultDrawer ?? undefined} />}

            {activeTab === 'aione' && <AiOneHome onNavigateToVaultDrawer={navigateToVaultDrawer} />}

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

      <VaultSearchModal
        isOpen={isVaultSearchOpen}
        onClose={() => setIsVaultSearchOpen(false)}
        onNavigateToVaultDrawer={navigateToVaultDrawer}
      />
    </RadioPlayerProvider>
  );
}