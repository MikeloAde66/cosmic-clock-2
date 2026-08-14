'use client';

import React from 'react';

interface LeftNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function LeftNav({ activeTab = 'aione', setActiveTab }: LeftNavProps) {
  const handleNavClick = (tabKey: string) => {
    if (setActiveTab) {
      setActiveTab(tabKey);
    }
  };

  return (
    <aside className="relative z-10 flex flex-col justify-between w-56 min-h-screen p-4 border-r bg-neutral-950 border-neutral-800">
      <div>
        {/* Top Branding / CC Logo (Pure Static Display) */}
        <div className="flex items-center mb-8 space-x-3">
          <div className="flex items-center justify-center w-10 h-10 font-mono text-xs font-bold border rounded-full border-neutral-700 bg-neutral-900 text-neutral-400">
            CC
          </div>
          <div>
            <h1 className="font-mono text-xs font-bold tracking-wider text-neutral-200">
              AIONE
            </h1>
            <p className="text-[10px] font-mono text-neutral-500">
              COSMIC HUD
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2 font-mono text-xs">
          <button
            onClick={() => handleNavClick('aione')}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded transition-all cursor-pointer ${
              activeTab === 'aione'
                ? 'bg-neutral-900 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border border-transparent'
            }`}
          >
            <span>💡</span>
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNavClick('radio')}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded transition-all cursor-pointer ${
              activeTab === 'radio'
                ? 'bg-neutral-900 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border border-transparent'
            }`}
          >
            <span>📻</span>
            <span>RADIO</span>
          </button>

          <button
            onClick={() => handleNavClick('vault')}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded transition-all cursor-pointer ${
              activeTab === 'vault'
                ? 'bg-neutral-900 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border border-transparent'
            }`}
          >
            <span>🏛️</span>
            <span>COSMIC VAULT</span>
          </button>

          <button
            onClick={() => handleNavClick('pods')}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded transition-all cursor-pointer ${
              activeTab === 'pods'
                ? 'bg-neutral-900 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border border-transparent'
            }`}
          >
            <span>🎙️</span>
            <span>PODS</span>
          </button>
        </nav>
      </div>

      <div className="pt-4 border-t border-neutral-900 text-[10px] font-mono text-neutral-600">
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>ADMIN AUTHORIZED</span>
        </div>
      </div>
    </aside>
  );
}