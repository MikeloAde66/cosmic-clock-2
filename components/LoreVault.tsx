'use client';

import React, { useState } from 'react';

interface VaultAsset {
  id: string;
  name: string;
  drawerNumber: string;
  category: 'pods' | 'music' | 'animations' | 'prototypes' | 'docs' | 'templates' | 'photos';
  description: string;
  date: string;
  url?: string;
  videoSrc?: string;
}

export default function LoreVault() {
  const [activeTab, setActiveTab] = useState<'PODS' | 'Radio' | 'Vault'>('PODS');
  
  // Security Key 432 Lock State
  const [securityPin, setSecurityPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Active Pod Video Selection
  const [selectedPodVideo, setSelectedPodVideo] = useState<string>('/assets/videos/ai-hub-cinematic.mp4');

  // Master Data Array
  const vaultAssets: VaultAsset[] = [
    {
      id: 'pod-001',
      name: 'Precession & Cosmic Cycles',
      drawerNumber: 'D-01',
      category: 'pods',
      description: 'Dialogue on historical time tracking frameworks and cosmic alignment.',
      date: '2026-07-28',
      videoSrc: '/assets/videos/ai-hub-cinematic.mp4',
    },
    {
      id: 'pod-002',
      name: 'Screen Time & Cognitive Saturation',
      drawerNumber: 'D-01',
      category: 'pods',
      description: 'Multi-part episode series.',
      date: '2026-08-01',
      videoSrc: '/assets/videos/the-chosen.mp4',
    },
    {
      id: 'proto-vq',
      name: 'VQ Demo Dashboard',
      drawerNumber: 'D-04',
      category: 'prototypes',
      description: 'Live interactive quantum simulation prototype interface.',
      date: '2026-08-04',
      url: 'https://vq-demo.protolabsglobal.com/',
    },
  ];

  const categories = ['pods', 'music', 'animations', 'prototypes', 'docs', 'templates', 'photos'];
  const podAssets = vaultAssets.filter((asset) => asset.category === 'pods');

  const getAutomatedDrawerItems = () => {
    return categories.map((cat) => {
      const itemsInCat = vaultAssets
        .filter((item) => item.category === cat)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return itemsInCat[0];
    }).filter(Boolean);
  };

  const automatedDrawers = getAutomatedDrawerItems();

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityPin.trim() === '432') {
      setIsUnlocked(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid Key Code.');
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      
      {/* HERO BANNER */}
      <div className="relative w-full h-80 bg-[#060a12] overflow-hidden border-b border-slate-800/80 flex flex-col items-center justify-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/20 via-indigo-500/30 to-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/70" />

        <div className="relative z-10 px-4 space-y-2 text-center">
          <h1 className="text-5xl md:text-6xl font-black tracking-wider text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">
            AI ONE
          </h1>
          <p className="font-mono text-xs tracking-widest uppercase md:text-sm text-slate-300">
            Cosmic Creation & Broadcast Hub
          </p>
        </div>
      </div>

      {/* SUB-NAV */}
      <div className="w-full bg-[#0b1326] border-b border-slate-800/80 flex justify-center items-center py-3 space-x-3 z-10">
        <button
          onClick={() => setActiveTab('PODS')}
          className={`px-5 py-2 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'PODS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          PODS
        </button>

        <button
          onClick={() => setActiveTab('Radio')}
          className={`px-5 py-2 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'Radio'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Radio
        </button>

        <button
          onClick={() => setActiveTab('Vault')}
          className={`px-5 py-2 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'Vault'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Cosmic Vault
        </button>
      </div>

      {/* MAIN CONTENT VIEW */}
      <div className="flex-1 w-full max-w-6xl px-6 py-10 mx-auto">
        
        {/* PODS TAB */}
        {activeTab === 'PODS' && (
          <div className="space-y-8">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-amber-400">PODS</h2>
            </div>

            {/* VIDEO PLAYER */}
            <div className="w-full overflow-hidden border shadow-2xl bg-slate-950 border-slate-800 rounded-2xl">
              <div className="relative flex items-center justify-center w-full bg-black aspect-video">
                <video
                  key={selectedPodVideo}
                  controls
                  controlsList="nodownload"
                  className="object-contain w-full h-full rounded-t-2xl"
                >
                  <source src={selectedPodVideo} type="video/mp4" />
                </video>
              </div>

              <div className="p-5 border-t bg-slate-900/90 border-slate-800">
                <h3 className="text-lg font-bold text-slate-100">
                  {podAssets.find((p) => p.videoSrc === selectedPodVideo)?.name || 'POD'}
                </h3>
              </div>
            </div>

            {/* EPISODES GRID */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {podAssets.map((pod) => (
                <button
                  key={pod.id}
                  onClick={() => pod.videoSrc && setSelectedPodVideo(pod.videoSrc)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedPodVideo === pod.videoSrc
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                    <span>{pod.drawerNumber}</span>
                    <span>{pod.date}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">{pod.name}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RADIO TAB - BBC & NPR ONLY */}
        {activeTab === 'Radio' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-amber-400">Radio</h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* BBC WORLD SERVICE */}
              <div className="p-6 space-y-4 border bg-slate-900/80 border-slate-800 rounded-xl">
                <h3 className="text-xl font-bold text-slate-100">BBC World Service</h3>
                <audio controls className="w-full">
                  <source src="https://stream.live.vc.bbcmedia.co.uk/bbc_world_service" type="audio/mpeg" />
                </audio>
              </div>

              {/* NPR */}
              <div className="p-6 space-y-4 border bg-slate-900/80 border-slate-800 rounded-xl">
                <h3 className="text-xl font-bold text-slate-100">NPR News</h3>
                <audio controls className="w-full">
                  <source src="https://npr-ice.streamguys1.com/live.mp3" type="audio/mpeg" />
                </audio>
              </div>
            </div>
          </div>
        )}

        {/* COSMIC VAULT TAB */}
        {activeTab === 'Vault' && (
          <div className="space-y-8">
            {!isUnlocked ? (
              <div className="max-w-md p-8 mx-auto my-12 space-y-6 text-center border shadow-xl bg-slate-900/90 border-slate-800 rounded-xl">
                <h2 className="text-xl font-bold text-slate-100">Cosmic Vault Authentication</h2>

                <form onSubmit={handleUnlock} className="space-y-4">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Enter Key..."
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value)}
                    className="w-full px-4 py-3 font-mono text-lg text-center border rounded bg-slate-950 border-slate-800 text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                  {errorMsg && <p className="font-mono text-xs text-rose-400">{errorMsg}</p>}
                  <button
                    type="submit"
                    className="w-full py-3 text-xs font-bold uppercase transition-all rounded bg-amber-500 hover:bg-amber-400 text-slate-950"
                  >
                    Authenticate
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <h2 className="text-2xl font-bold text-amber-400">Automated Asset Drawers</h2>
                  <button
                    onClick={() => setIsUnlocked(false)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded font-mono"
                  >
                    LOCK VAULT
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-all border ${
                      selectedCategory === 'ALL'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    ALL DRAWERS
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat.toUpperCase())}
                      className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-all border ${
                        selectedCategory === cat.toUpperCase()
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {automatedDrawers
                    .filter((item) => selectedCategory === 'ALL' || item.category.toUpperCase() === selectedCategory)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between p-5 space-y-4 border bg-slate-900/80 border-slate-800 rounded-xl"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-800/60 text-amber-400 rounded">
                              {item.drawerNumber}
                            </span>
                            <span className="text-slate-500">{item.date}</span>
                          </div>

                          <h3 className="text-base font-bold text-slate-100">{item.name}</h3>
                          <p className="text-xs text-slate-400">{item.description}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}