'use client';

import React from 'react';
import type { TrackingRate } from '@/lib/telescopeProtocol';

const TRACKING_RATE_LABELS: Record<TrackingRate, string> = {
  sidereal: 'SIDEREAL',
  solar: 'SOLAR',
  lunar: 'LUNAR',
  stopped: 'STOPPED',
};
const ALL_TRACKING_RATES: TrackingRate[] = ['sidereal', 'solar', 'lunar', 'stopped'];

export interface HudControlPanelProps {
  hudOpacity: number; // 0-1, a real local UI preference — this panel's own opacity, nothing else
  onHudOpacityChange: (v: number) => void;
  trackingRate: TrackingRate | null; // last rate genuinely commanded — null while disconnected or unset
  supportedTrackingRates: TrackingRate[]; // presets this protocol/mode can actually command right now
  onTrackingRateChange: (rate: TrackingRate) => void;
  isTelescopeConnected: boolean;
}

export const HudControlPanel: React.FC<HudControlPanelProps> = ({
  hudOpacity,
  onHudOpacityChange,
  trackingRate,
  supportedTrackingRates,
  onTrackingRateChange,
  isTelescopeConnected,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 font-mono text-cyan-400 mt-4 w-full space-y-4">
      <div className="text-xs tracking-wider text-slate-400 border-b border-slate-800 pb-2">HUD CONTROLS</div>

      {/* TRACKING RATE — real command sent to the mount (or genuine simulator
          state) when a preset is selectable; presets outside
          supportedTrackingRates are disabled rather than silently no-op'd,
          since this protocol/mode combination has no real command for them. */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">
          <span>Tracking Rate</span>
          <span className="text-slate-300">{trackingRate ? TRACKING_RATE_LABELS[trackingRate] : isTelescopeConnected ? 'UNSET' : 'NO LINK'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TRACKING_RATES.map((rate) => {
            const supported = supportedTrackingRates.includes(rate);
            const active = trackingRate === rate;
            return (
              <button
                key={rate}
                type="button"
                disabled={!supported}
                onClick={() => onTrackingRateChange(rate)}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide rounded border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-700 text-slate-400 hover:border-cyan-400 hover:text-cyan-300'
                }`}
              >
                {TRACKING_RATE_LABELS[rate]}
              </button>
            );
          })}
        </div>
        {isTelescopeConnected && supportedTrackingRates.length < ALL_TRACKING_RATES.length && (
          <p className="text-[9px] text-slate-600 mt-1">
            Some presets are disabled — the connected protocol has no documented command for them.
          </p>
        )}
      </div>

      {/* SENSOR GAIN — permanently disabled. This app has no camera/sensor
          pipeline (just RA/Dec mount position over LX200/NexStar), so there
          is no real "gain" telemetry anywhere to wire this to. Left visible
          but inert rather than fabricating a number, and rather than
          deleting a control the design calls for. */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">
          <span>Sensor Gain</span>
          <span className="text-slate-600">NO SENSOR LINK</span>
        </div>
        <input
          type="range"
          disabled
          value={0}
          min={0}
          max={100}
          readOnly
          className="w-full accent-slate-600 opacity-40 cursor-not-allowed"
        />
        <p className="text-[9px] text-slate-600 mt-1">This build has no camera/sensor integration to report gain from.</p>
      </div>

      {/* HUD OPACITY — a real local UI preference, controls this HUD panel's
          own backdrop opacity directly (see StarTrackerView's inline style). */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">
          <span>HUD Opacity</span>
          <span className="text-slate-300">{Math.round(hudOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={30}
          max={100}
          value={Math.round(hudOpacity * 100)}
          onChange={(e) => onHudOpacityChange(Number(e.target.value) / 100)}
          className="w-full accent-cyan-400"
        />
      </div>
    </div>
  );
};

export default HudControlPanel;
