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

export default function CosmicVaultAuth() {
  // Security Key 432 Lock State
  const [securityPin, setSecurityPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Master Data Array
  const vaultAssets: VaultAsset[] = [
    {
      id: 'pod-001',
      name: 'Precession & Cosmic Cycles',
      drawerNumber: 'D-01',
      category: 'pods',
      description: 'Dialogue on historical time tracking frameworks and cosmic alignment.',
      date: '2026-07-28',
      videoSrc: '/assets/videos/pod-sample.mp4',
    },
    {
      id: 'pod-002',
      name: 'Screen Time & Cognitive Saturation',
      drawerNumber: 'D-01',
      category: 'pods',
      description: 'Multi-part episode series.',
      date: '2026-08-01',
      videoSrc: '/assets/videos/screen-time-ep1.mp4',
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
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-6xl px-6 py-10 mx-auto space-y-8">
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
                className="w-full px-4 py-3 font-mono text-lg text-center border rounded bg-slate-950 border-slate-800 text-white focus:outline-none focus:border-white/50"
              />
              {errorMsg && <p className="font-mono text-xs text-rose-400">{errorMsg}</p>}
              <button
                type="submit"
                className="w-full py-3 text-xs font-bold uppercase transition-all rounded bg-white hover:bg-neutral-200 text-slate-950"
              >
                Authenticate
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-white">Automated Asset Drawers</h2>
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
                    ? 'bg-white/20 text-white border-neutral-700'
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
                      ? 'bg-white/20 text-white border-neutral-700'
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
                        <span className="px-2 py-0.5 bg-neutral-800/80 border border-neutral-700 text-white rounded">
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
    </div>
  );
}
