'use client';

import React from 'react';
import { Rows3, LayoutGrid, Layers } from 'lucide-react';

export type LayoutMode = 'hub' | 'gallery' | 'stack';

interface LayoutModeToggleProps {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

const MODES: { key: LayoutMode; label: string; Icon: typeof Layers }[] = [
  { key: 'hub', label: 'Classic Hub', Icon: Layers },
  { key: 'gallery', label: 'Gallery Grid', Icon: LayoutGrid },
  { key: 'stack', label: 'Continuous Stack', Icon: Rows3 },
];

// A deliberate, explicit exception to this app's usual "dedicated views,
// never stacked together" rule — the user opts into Stack mode via this
// toggle, so any crowding it introduces is an intentional choice rather
// than an accidental popup/overlay.
export default function LayoutModeToggle({ mode, onChange }: LayoutModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 border rounded-full bg-neutral-900/80 border-neutral-700">
      {MODES.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-label={label}
          title={label}
          className={`flex items-center justify-center w-7 h-7 rounded-full transition-all cursor-pointer ${
            mode === key ? 'bg-white text-neutral-950' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
