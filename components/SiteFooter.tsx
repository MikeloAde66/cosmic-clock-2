'use client';

import React, { useEffect, useState } from 'react';
import { Apple, Music2, Smartphone } from 'lucide-react';

function useLiveClock() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
      const month = now.toLocaleDateString('en-US', { month: 'short' });
      const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      setLabel(`${weekday} ${month} ${now.getDate()} ${time}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return label;
}

// Placeholder destinations — swap for the real profile URLs once they exist.
const SOCIAL_LINKS = [
  { name: 'Facebook', glyph: 'FB', href: 'https://facebook.com/your-page' },
  { name: 'Instagram', glyph: 'IG', href: 'https://instagram.com/your-handle' },
  { name: 'Reddit', glyph: 'r/', href: 'https://reddit.com/r/your-subreddit' },
  { name: 'TikTok', icon: Music2, href: 'https://tiktok.com/@your-handle' },
  { name: 'X', glyph: '𝕏', href: 'https://x.com/your-handle' },
  { name: 'YouTube', glyph: 'YT', href: 'https://youtube.com/@your-channel' },
];

export default function SiteFooter() {
  const clockLabel = useLiveClock();

  return (
    <footer className="w-full shrink-0 bg-[#04060A] border-t border-slate-800/80 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">EARTH TIME</span>
          <span className="text-white font-bold bg-white/10 border border-neutral-700/30 px-2 py-0.5 rounded">
            {clockLabel || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">KALI YUGA</span>
          <span className="text-slate-100 font-medium">YEAR 5,128</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-slate-500">
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="hover:text-white transition-colors"
          >
            {s.icon ? <s.icon size={16} /> : <span className="font-bold text-sm">{s.glyph}</span>}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded text-[10px] text-slate-300">
          <Apple size={12} /> App Store
        </button>
        <button className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded text-[10px] text-slate-300">
          <Smartphone size={12} /> Google Play
        </button>
      </div>
    </footer>
  );
}
