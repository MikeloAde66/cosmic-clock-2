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
        <TopHeader />

        <div className="relative flex-1 overflow-hidden">
          {activeTab === 'radio' && <RadioStreams />}

          {activeTab === 'vault' && <CosmicVaultAuth />}

          {activeTab === 'aione' && <AiOneHome />}

          {activeTab === 'fact-checker' && (
            <div className="w-full h-full p-6 overflow-auto">
              <FactChecker />
            </div>
          )}

          {activeTab === 'pods' && <PodsModule />}
        </div>

        <SiteFooter />
      </div>
    </main>
  );
}