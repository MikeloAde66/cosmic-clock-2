'use client';
import { useContextMenuShare } from '@/components/useContextMenuShare';
import React, { useState } from 'react';
import TopHeader from '@/components/TopHeader';
import LeftNav from '@/components/LeftNav';
import FactChecker from '@/components/FactChecker';
import PodsModule from '@/components/PodsModule';
import CosmicVaultAuth from '@/components/CosmicVaultAuth';
import AiOneHome from '@/components/AiOneHome';
import RadioStreams from '@/components/RadioStreams';
import SiteFooter from '@/components/SiteFooter';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('aione');
useContextMenuShare();
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#0a0a0c]">
      <LeftNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopHeader activeTab={activeTab} />

        <div className="relative flex-1 overflow-hidden">
          {activeTab === 'radio' && <RadioStreams />}

          {activeTab === 'vault' && <CosmicVaultAuth />}

          {activeTab === 'aione' && <AiOneHome />}

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
            <PodsModule />
          </div>
        </div>

        <SiteFooter />
      </div>
    </main>
  );
}