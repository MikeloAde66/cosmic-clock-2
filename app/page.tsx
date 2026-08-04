'use client';
import { useContextMenuShare } from '@/components/useContextMenuShare';
import React, { useState } from 'react';
import TopHeader from '@/components/TopHeader';
import LeftNav from '@/components/LeftNav';
import CosmicCanvas from '@/components/CosmicCanvas';
import FactChecker from '@/components/FactChecker';
import PodsModule from '@/components/PodsModule';
import LoreVault from '@/components/LoreVault';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('clock');
useContextMenuShare();
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#0a0a0c]">
      <LeftNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopHeader />

        <div className="relative flex-1 overflow-hidden">
          {activeTab === 'clock' && <CosmicCanvas />}

          {activeTab === 'vault' && <LoreVault />}

          {activeTab === 'fact-checker' && (
            <div className="w-full h-full p-6 overflow-auto">
              <FactChecker />
            </div>
          )}

          {activeTab === 'pods' && <PodsModule />}
        </div>
      </div>
    </main>
  );
}