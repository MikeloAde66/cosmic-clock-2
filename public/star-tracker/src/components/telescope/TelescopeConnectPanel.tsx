
import React, { useState } from 'react';
import { Bluetooth, Crosshair, Loader2, Telescope, Unplug, Usb } from 'lucide-react';
import type { TelescopeConnection } from '@/lib/useTelescopeConnection';
import { TELESCOPE_PROTOCOLS } from '@/lib/telescopeProtocol';
import type { TelescopeProtocolId } from '@/lib/telescopeProtocol';

function formatRa(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function formatDec(deg: number) {
  const sign = deg < 0 ? '-' : '+';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}'`;
}

// Quick test targets so Simulator Mode's slewing is exercisable without
// needing the 3D orb view (or real hardware) — Zenith is always reachable,
// Polaris approximates true north for northern-hemisphere observers.
const TEST_TARGETS = [
  { label: 'Zenith', raHours: 12, decDeg: 90 },
  { label: 'Polaris', raHours: 2.5303, decDeg: 89.2641 },
];

export default function TelescopeConnectPanel({ connection }: { connection: TelescopeConnection }) {
  const [open, setOpen] = useState(false);
  const {
    protocolId,
    setProtocolId,
    mode,
    transport,
    position,
    slewing,
    errorMessage,
    isSupported,
    connectSerial,
    connectBluetooth,
    enableSimulator,
    disconnect,
    slewTo,
  } = connection;

  const isConnected = mode === 'connected' || mode === 'simulator';

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded-full border transition ${
          isConnected ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'
        }`}
      >
        <Telescope className="w-3 h-3" />
        {isConnected ? `Telescope: ${transport === 'simulator' ? 'Simulator' : 'Connected'}` : 'Connect Telescope'}
      </button>

      {open && (
        <div className="mt-2 p-3 space-y-3 border rounded-lg border-cyan-500/20 bg-black/30">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Mount Protocol</span>
            <select
              value={protocolId}
              onChange={(e) => setProtocolId(e.target.value as TelescopeProtocolId)}
              disabled={isConnected}
              className="bg-slate-900/90 text-cyan-300 text-[10px] font-mono border border-slate-700/80 rounded px-2 py-1 disabled:opacity-50"
            >
              {Object.values(TELESCOPE_PROTOCOLS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {!isConnected ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={connectSerial}
                  disabled={mode === 'connecting'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide rounded border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  {mode === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Usb className="w-3 h-3" />}
                  USB / Serial
                </button>
                <button
                  type="button"
                  onClick={connectBluetooth}
                  disabled={mode === 'connecting'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide rounded border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  <Bluetooth className="w-3 h-3" />
                  Bluetooth
                </button>
                <button
                  type="button"
                  onClick={enableSimulator}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide rounded border border-purple-500/40 text-purple-300 hover:border-purple-400"
                >
                  <Crosshair className="w-3 h-3" />
                  Simulator Mode
                </button>
              </div>

              {!isSupported.serial && !isSupported.bluetooth && (
                <p className="font-mono text-[10px] text-slate-500">
                  Web Serial / Web Bluetooth aren’t available in this browser — Chrome or Edge on desktop only. Use Simulator Mode to try the flow here.
                </p>
              )}
              <p className="font-mono text-[10px] text-slate-600">
                Bluetooth pairing only sees BLE UART bridge adapters — most LX200/NexStar Bluetooth adapters use classic Bluetooth (SPP) and
                won’t appear. Use USB/Serial for those.
              </p>
              {errorMessage && <p className="font-mono text-[10px] text-rose-400">{errorMessage}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 border rounded border-cyan-500/10 bg-cyan-500/5">
                <div className="font-mono text-[10px] text-slate-400">
                  <div>RA {position ? formatRa(position.raHours) : '—'}</div>
                  <div>Dec {position ? formatDec(position.decDeg) : '—'}</div>
                </div>
                {slewing && (
                  <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-cyan-300">
                    <Loader2 className="w-3 h-3 animate-spin" /> Slewing…
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {TEST_TARGETS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => slewTo(t)}
                    disabled={slewing}
                    className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide rounded border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                  >
                    Slew to {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={disconnect}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide rounded border border-slate-700 text-slate-400 hover:border-rose-400 hover:text-rose-300"
                >
                  <Unplug className="w-3 h-3" />
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
