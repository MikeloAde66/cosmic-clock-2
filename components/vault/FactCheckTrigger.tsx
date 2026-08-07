'use client';

// ARCHIVED: this was the Fact Check trigger button in TopHeader.tsx's
// action row, removed from the live header on request. The full Fact
// Checker page (components/FactChecker.tsx) and its route
// (activeTab === 'fact-checker' in app/page.tsx) are both still intact and
// untouched — only this header entry point was pulled. To restore, drop
// this button back into TopHeader.tsx's action row and pass `setActiveTab`
// back down from app/page.tsx as a prop, same as it worked before.

import React from 'react';

interface FactCheckTriggerProps {
  setActiveTab?: (tab: string) => void;
}

export default function FactCheckTrigger({ setActiveTab }: FactCheckTriggerProps) {
  return (
    <button
      onClick={() => setActiveTab?.('fact-checker')}
      className="flex items-center space-x-1.5 bg-neutral-900 border border-amber-500/40 hover:border-amber-500 px-2.5 py-1 rounded text-xs text-amber-400 font-mono transition-all cursor-pointer"
      title="Verify storyline / Fact Check"
    >
      <span>💡</span>
      <span className="hidden sm:inline">FACT CHECK</span>
    </button>
  );
}
