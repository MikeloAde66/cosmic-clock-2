'use client';

import React from 'react';

interface LeftNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function LeftNav({ activeTab = 'clock', setActiveTab }: LeftNavProps) {
  const navItems = [
    {
      id: 'clock',
      label: 'CLOCK',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'vault',
      label: 'COSMIC VAULT',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'fact-checker',
      label: 'FACT CHECKER',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h-4a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      id: 'pods',
      label: 'PODS',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[#2a2a30] bg-[#0a0a0c] p-4 text-white select-none">
      <div className="flex items-center gap-3 px-2 pt-2 mb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4af37]/60 bg-[#16161a] text-[10px] font-mono font-bold text-[#d4af37]">
          CC
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-widest text-[#d4af37]">AIONE</span>
          <span className="text-[9px] font-mono tracking-wider text-gray-500 uppercase">COSMIC HUD</span>
        </div>
      </div>

      <nav className="flex flex-col flex-1 gap-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab && setActiveTab(item.id)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-mono tracking-wider transition-all duration-150 ${
                isActive
                  ? 'border border-[#d4af37]/50 bg-[#16161a] text-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.15)]'
                  : 'text-gray-400 hover:border hover:border-[#2a2a30] hover:bg-[#121215] hover:text-gray-200'
              }`}
            >
              <span className={isActive ? 'text-[#d4af37]' : 'text-gray-500'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#2a2a30] pt-4 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono tracking-wider text-gray-400">ADMIN AUTHORIZED</span>
        </div>
        <p className="mt-1 text-[9px] font-mono text-gray-600">KEY: 5128 | 432 Hz ACTIVE</p>
      </div>
    </aside>
  );
}