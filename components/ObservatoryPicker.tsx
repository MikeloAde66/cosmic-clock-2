'use client';

import React from 'react';

export interface Observatory {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationMeters: number;
  location: string;
}

// 'local' is a sentinel, not a real fixed site — StarTrackerView treats it
// specially and always substitutes the real, live-tracked coords (GPS or
// the IP-geolocation fallback already built there) instead of ever
// reading this entry's own lat/lon/elevation, which are unused
// placeholders. The other five are real observatories with real
// public coordinates/elevations.
export const OBSERVATORIES: Observatory[] = [
  { id: 'local', name: 'Local Observer', lat: 0, lon: 0, elevationMeters: 0, location: 'Your live location' },
  { id: 'mauna-kea', name: 'Mauna Kea Observatories', lat: 19.8207, lon: -155.4681, elevationMeters: 4207, location: 'Hawaiʻi, USA' },
  { id: 'palomar', name: 'Palomar Observatory', lat: 33.3561, lon: -116.865, elevationMeters: 1706, location: 'California, USA' },
  { id: 'greenwich', name: 'Royal Observatory Greenwich', lat: 51.4769, lon: 0.0005, elevationMeters: 46, location: 'London, UK' },
  { id: 'griffith', name: 'Griffith Observatory', lat: 34.1184, lon: -118.3004, elevationMeters: 346, location: 'Los Angeles, USA' },
  { id: 'vlt', name: 'Very Large Telescope (VLT)', lat: -24.6272, lon: -70.4042, elevationMeters: 2635, location: 'Atacama, Chile' },
];

interface ObservatoryPickerProps {
  selectedId: string;
  onSelectObservatory: (observatory: Observatory) => void;
}

export default function ObservatoryPicker({ selectedId, onSelectObservatory }: ObservatoryPickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = OBSERVATORIES.find((obs) => obs.id === e.target.value);
    if (selected) onSelectObservatory(selected);
  };

  return (
    <div className="flex flex-col items-start gap-1 font-mono">
      <label className="text-[10px] tracking-widest text-cyan-400 uppercase">Observer Horizon Node</label>
      <div className="relative inline-block w-full max-w-xs">
        <select
          value={selectedId}
          onChange={handleChange}
          className="w-full bg-slate-900/90 text-cyan-300 text-xs font-mono border border-slate-700/80 rounded-md px-3 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none shadow-inner"
        >
          {OBSERVATORIES.map((obs) => (
            <option key={obs.id} value={obs.id} className="bg-slate-900 text-slate-200">
              {obs.id === 'local' ? obs.name : `${obs.name} (${obs.location})`}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-cyan-500 text-xs">▼</div>
      </div>
    </div>
  );
}
