'use client';

import React, { useState } from 'react';
import CosmicCanvas from '@/components/CosmicCanvas';
import LeftNav from '@/components/LeftNav';
import LoreVault from '@/components/LoreVault';
import EpochDial from '@/components/EpochDial';
import NoaaWidget from '@/components/NoaaWidget';
import CosmicConverter from '@/components/CosmicConverter';
import EmbeddedVideoCard from '@/components/EmbeddedVideoCard';
import { audioEngine } from '@/lib/audioEngine';

type NavTab = 'clock' | 'vault' | 'fact-checker' | 'pods';

export default function CosmicClockApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('clock');
  const [isAudioActive, setIsAudioActive] = useState(false);

  const toggleAudio = () => {
    if (!audioEngine) return;

    const engine = audioEngine as { start?: () => void; stop?: () => void };

    if (isAudioActive) {
      engine.stop?.();
      setIsAudioActive(false);
    } else {
      engine.start?.();
      setIsAudioActive(true);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#05070e] text-slate-100 overflow-hidden font-sans flex">
      {/* Background Starfield Canvas */}
      <CosmicCanvas />

      {/* 1. Left Navigation Bar */}
      <LeftNav activeTab={activeTab} setActiveTab={(tab: NavTab) => setActiveTab(tab)} />

      {/* 2. Main Space Container */}
      <div className="relative z-10 flex flex-col flex-1 min-h-screen p-4 md:p-6 lg:p-8 max-w-[1700px] mx-auto overflow-y-auto">
        
        {/* TAB 1: MAIN CLOCK VIEW */}
        {activeTab === 'clock' && (
          <div className="flex flex-col gap-6">
            <header className="flex items-start justify-between">
              <div>
                <h1 className="font-mono text-2xl font-bold tracking-widest uppercase text-amber-400">
                  Cosmic Clock
                </h1>
                <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Real-Time Epoch &amp; Harmonic Resonance HUD
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAudio}
                  className={`px-3 py-1.5 rounded border text-xs font-mono tracking-wider transition-all ${
                    isAudioActive
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isAudioActive ? '🔊 432Hz AUDIO LIVE' : '🔇 AUDIO MUTED'}
                </button>
              </div>
            </header>

            {/* Reordered Dashboard Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column: NOAA Weather & Video Stream */}
              <div className="flex flex-col gap-6">
                <NoaaWidget />
                <EmbeddedVideoCard />
              </div>

              {/* Right Column: Center Dial & Frequency Tools */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                <EpochDial />
                <CosmicConverter />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COSMIC VAULT / LORE */}
        {activeTab === 'vault' && <LoreVault />}

        {/* TAB 3: FACT CHECKER */}
        {activeTab === 'fact-checker' && (
          <div className="p-8 border rounded-xl bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <h2 className="mb-2 font-mono text-xl text-amber-400">FACT CHECKER ENGINE</h2>
            <p className="text-sm text-slate-400">RAG-driven cosmological and astronomical verifications module.</p>
          </div>
        )}

        {/* TAB 4: PODS */}
        {activeTab === 'pods' && (
          <div className="p-8 border rounded-xl bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <h2 className="mb-2 font-mono text-xl text-amber-400">COSMIC PODS &amp; FEEDS</h2>
            <p className="text-sm text-slate-400">Audio feeds and media pod streams calibrated to 432Hz harmonics.</p>
          </div>
        )}

      </div>
    </div>
  );
}