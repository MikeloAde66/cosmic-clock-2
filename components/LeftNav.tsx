"use client";

import React from "react";

export type NavTab = "clock" | "vault" | "fact-checker" | "pods";

export interface LeftNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export default function LeftNav({ activeTab, setActiveTab }: LeftNavProps) {
  const navItems: { id: NavTab; label: string; icon: string }[] = [
    { id: "clock", label: "Clock", icon: "🌌" },
    { id: "vault", label: "Cosmic Vault", icon: "🏛️" },
    { id: "fact-checker", label: "Fact Checker", icon: "🧠" },
    { id: "pods", label: "Pods", icon: "🎙️" },
  ];

  return (
    <aside className="z-30 flex flex-col justify-between w-16 min-h-screen p-3 border-r lg:w-52 bg-slate-950/90 border-slate-800/80 backdrop-blur-md shrink-0">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-1 py-2 pb-4 border-b border-slate-800/60">
          <div className="flex items-center justify-center font-mono text-xs font-bold border shadow-lg w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border-amber-500/40 text-amber-400 shadow-amber-500/5">
            CC
          </div>
          <div className="flex-col hidden lg:flex">
            <span className="font-mono text-xs font-bold tracking-widest text-slate-100">
              AIONE
            </span>
            <span className="text-[9px] font-mono text-amber-400/80 tracking-wider uppercase">
              Cosmic HUD
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-200 text-left font-mono ${
                  isActive
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/5"
                    : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200 border border-transparent"
                }`}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                <span className="hidden text-xs font-semibold tracking-wider uppercase lg:inline">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="px-2 py-3 border-t border-slate-800/60 bg-slate-900/30 rounded-xl">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="flex-col hidden lg:flex">
            <span className="font-mono text-[10px] font-bold text-slate-300">
              SYSTEM ONLINE
            </span>
            <span className="font-mono text-[8px] text-slate-500 uppercase">
              432 Hz Sync
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}