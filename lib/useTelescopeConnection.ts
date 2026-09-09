'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TELESCOPE_PROTOCOLS,
  BLE_UART_SERVICE_UUID,
  BLE_UART_RX_CHARACTERISTIC_UUID,
  BLE_UART_TX_CHARACTERISTIC_UUID,
  type TelescopeProtocolId,
  type TelescopePosition,
  type TrackingRate,
} from './telescopeProtocol';

// Web Serial and Web Bluetooth aren't part of TypeScript's bundled DOM lib
// (both remain non-standard, Chromium-only APIs) — minimal ambient shapes
// for just what's used below, not a full spec surface.
interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface BluetoothRemoteGATTCharacteristicLike extends EventTarget {
  writeValue: (data: BufferSource) => Promise<void>;
  startNotifications: () => Promise<void>;
  value?: DataView;
}
interface BluetoothRemoteGATTServiceLike {
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristicLike>;
}
interface BluetoothRemoteGATTServerLike {
  connect: () => Promise<BluetoothRemoteGATTServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTServiceLike>;
}
interface BluetoothDeviceLike {
  gatt?: BluetoothRemoteGATTServerLike;
}
declare global {
  interface Navigator {
    serial?: {
      requestPort: () => Promise<SerialPortLike>;
    };
    bluetooth?: {
      requestDevice: (options: { filters: { services: string[] }[] }) => Promise<BluetoothDeviceLike>;
    };
  }
}

export type TelescopeConnectionMode = 'disconnected' | 'connecting' | 'connected' | 'simulator' | 'error';
export type TelescopeTransportKind = 'serial' | 'bluetooth' | 'simulator' | null;

const POSITION_POLL_MS = 1000;
const SLEW_POLL_MS = 700;
const SLEW_TIMEOUT_MS = 20000;
const SLEW_DONE_EPSILON = 0.05; // hours/degrees — close enough to call a goto complete

function positionsClose(a: TelescopePosition, b: TelescopePosition) {
  return Math.abs(a.raHours - b.raHours) < SLEW_DONE_EPSILON && Math.abs(a.decDeg - b.decDeg) < SLEW_DONE_EPSILON;
}

// Real spherical angular separation (law of cosines), not a flat/Euclidean
// approximation — used for both the live target-delta readout and to derive
// slew progress from real positions, never a fabricated percentage.
function angularSeparationDeg(a: TelescopePosition, b: TelescopePosition): number {
  const raA = (a.raHours * 15 * Math.PI) / 180;
  const raB = (b.raHours * 15 * Math.PI) / 180;
  const decA = (a.decDeg * Math.PI) / 180;
  const decB = (b.decDeg * Math.PI) / 180;
  const cosSep = Math.sin(decA) * Math.sin(decB) + Math.cos(decA) * Math.cos(decB) * Math.cos(raA - raB);
  return (Math.acos(Math.min(1, Math.max(-1, cosSep))) * 180) / Math.PI;
}

export function useTelescopeConnection() {
  const [protocolId, setProtocolId] = useState<TelescopeProtocolId>('lx200');
  const [mode, setMode] = useState<TelescopeConnectionMode>('disconnected');
  const [transport, setTransport] = useState<TelescopeTransportKind>(null);
  const [position, setPosition] = useState<TelescopePosition | null>(null);
  const [slewing, setSlewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState({ serial: false, bluetooth: false });
  // The most recent commanded goto target, set by slewTo — real telemetry
  // (target-delta, slew progress) is derived from this plus live position
  // below, never fabricated. null until the first slewTo call this session.
  const [lastTarget, setLastTarget] = useState<TelescopePosition | null>(null);
  // Optional human-readable name for lastTarget, e.g. "Zenith"/"Polaris"
  // from TelescopeConnectPanel's real test-target buttons — a caller that
  // doesn't pass one (an RA/Dec-only goto) just leaves this null, same
  // never-fabricated discipline as the coordinates themselves.
  const [lastTargetName, setLastTargetName] = useState<string | null>(null);
  // Exact only for the simulator, whose slew duration/easing this hook
  // itself controls — a real mount's slew rate isn't reported by either
  // supported protocol, so this stays null for real hardware rather than
  // guessing at an ETA the app can't actually know.
  const [simulatorEtaSeconds, setSimulatorEtaSeconds] = useState<number | null>(null);
  // Real, measured drift between consecutive *idle* position polls (not
  // computed while slewing) — how far the reported position moved since the
  // last poll, converted to arcsec/sec. null until two idle polls exist.
  const [driftRateArcsecPerSec, setDriftRateArcsecPerSec] = useState<number | null>(null);
  // State, not a ref — slewProgressPercent below reads it during render to
  // produce real UI output, and a ref's current value can't safely be read
  // there (React has no way to know to re-render when only a ref changes).
  const [slewStartDelta, setSlewStartDelta] = useState<number | null>(null);
  const lastIdlePollRef = useRef<{ position: TelescopePosition; time: number } | null>(null);
  // Last rate this hook actually commanded — for real hardware, LX200/
  // NexStar have no read-back command for tracking rate, so this is "last
  // commanded" not "confirmed current," same discipline as lastTarget/
  // lastTargetName. null until the user picks one (real hardware) or the
  // simulator is enabled (which does know its own state with certainty).
  const [trackingRate, setTrackingRateState] = useState<TrackingRate | null>(null);

  useEffect(() => {
    setIsSupported({
      serial: typeof navigator !== 'undefined' && !!navigator.serial,
      bluetooth: typeof navigator !== 'undefined' && !!navigator.bluetooth,
    });
  }, []);

  const portRef = useRef<SerialPortLike | null>(null);
  const gattServerRef = useRef<BluetoothRemoteGATTServerLike | null>(null);
  const bleTxCharRef = useRef<BluetoothRemoteGATTCharacteristicLike | null>(null);
  const bleRxCharRef = useRef<BluetoothRemoteGATTCharacteristicLike | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readAbortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef('');
  const slewAnimationRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const write = useCallback(async (data: string) => {
    if (transport === 'bluetooth' && bleRxCharRef.current) {
      const bytes = new TextEncoder().encode(data);
      // BLE's default ATT MTU is 20 bytes — chunk writes so longer combined
      // LX200 goto commands (":Sr...#:Sd...#:MS#") don't silently truncate.
      for (let i = 0; i < bytes.length; i += 20) {
        await bleRxCharRef.current.writeValue(bytes.slice(i, i + 20));
      }
      return;
    }
    if (transport === 'serial' && writerRef.current) {
      await writerRef.current.write(new TextEncoder().encode(data));
      return;
    }
  }, [transport]);

  const requestPosition = useCallback(async (): Promise<TelescopePosition | null> => {
    const adapter = TELESCOPE_PROTOCOLS[protocolId];
    bufferRef.current = '';
    await write(adapter.getPositionCommand);
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const parsed = adapter.parsePositionResponse(bufferRef.current);
      if (parsed) {
        bufferRef.current = '';
        return parsed;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }, [protocolId, write]);

  const disconnect = useCallback(async () => {
    clearIntervalRef();
    if (slewAnimationRef.current) cancelAnimationFrame(slewAnimationRef.current);
    readAbortRef.current?.abort();
    readAbortRef.current = null;

    if (writerRef.current) {
      try {
        writerRef.current.releaseLock();
      } catch {}
      writerRef.current = null;
    }
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {}
      portRef.current = null;
    }
    if (gattServerRef.current) {
      try {
        gattServerRef.current.disconnect();
      } catch {}
      gattServerRef.current = null;
    }
    bleTxCharRef.current = null;
    bleRxCharRef.current = null;

    setMode('disconnected');
    setTransport(null);
    setPosition(null);
    setSlewing(false);
    setErrorMessage(null);
    setLastTarget(null);
    setLastTargetName(null);
    setSimulatorEtaSeconds(null);
    setDriftRateArcsecPerSec(null);
    setSlewStartDelta(null);
    setTrackingRateState(null);
    lastIdlePollRef.current = null;
  }, [clearIntervalRef]);

  // Real, measured drift between consecutive idle polls — never called while
  // slewing (that's real motion, not drift) or across a slew boundary (the
  // ref is cleared at slew start in slewTo below, so the first post-slew
  // sample doesn't get read as a huge fake "drift").
  const recordIdlePositionSample = useCallback((pos: TelescopePosition) => {
    const nowMs = Date.now();
    const prev = lastIdlePollRef.current;
    if (prev) {
      const dtSeconds = (nowMs - prev.time) / 1000;
      if (dtSeconds > 0.1) {
        const deltaDeg = angularSeparationDeg(prev.position, pos);
        setDriftRateArcsecPerSec((deltaDeg * 3600) / dtSeconds);
      }
    }
    lastIdlePollRef.current = { position: pos, time: nowMs };
  }, []);

  // Regular idle-rate position polling once a real transport is connected.
  useEffect(() => {
    if (mode !== 'connected' || transport === 'simulator') return;
    clearIntervalRef();
    intervalRef.current = setInterval(() => {
      requestPosition().then((pos) => {
        if (pos) {
          setPosition(pos);
          recordIdlePositionSample(pos);
        }
      });
    }, POSITION_POLL_MS);
    return clearIntervalRef;
  }, [mode, transport, requestPosition, clearIntervalRef, recordIdlePositionSample]);

  const connectSerial = useCallback(async () => {
    if (!navigator.serial) {
      setErrorMessage('Web Serial isn’t available in this browser — try Chrome or Edge.');
      setMode('error');
      return;
    }
    setMode('connecting');
    setErrorMessage(null);
    try {
      const port = await navigator.serial.requestPort();
      const adapter = TELESCOPE_PROTOCOLS[protocolId];
      await port.open({ baudRate: adapter.baudRate });
      portRef.current = port;

      if (port.writable) writerRef.current = port.writable.getWriter();

      const controller = new AbortController();
      readAbortRef.current = controller;
      if (port.readable) {
        (async () => {
          const reader = port.readable!.getReader();
          const decoder = new TextDecoder();
          try {
            while (!controller.signal.aborted) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) bufferRef.current += decoder.decode(value, { stream: true });
            }
          } catch {
            // Port closed/unplugged mid-read — disconnect() already tears
            // this loop down via the abort signal in the common case.
          } finally {
            reader.releaseLock();
          }
        })();
      }

      setTransport('serial');
      setMode('connected');
    } catch (err) {
      console.error('Telescope serial connect failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not open serial connection.');
      setMode('error');
    }
  }, [protocolId]);

  const connectBluetooth = useCallback(async () => {
    if (!navigator.bluetooth) {
      setErrorMessage('Web Bluetooth isn’t available in this browser — try Chrome or Edge.');
      setMode('error');
      return;
    }
    setMode('connecting');
    setErrorMessage(null);
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_UART_SERVICE_UUID] }] });
      if (!device.gatt) throw new Error('Selected device has no GATT server.');
      const server = await device.gatt.connect();
      gattServerRef.current = server;
      const service = await server.getPrimaryService(BLE_UART_SERVICE_UUID);
      const txChar = await service.getCharacteristic(BLE_UART_TX_CHARACTERISTIC_UUID);
      const rxChar = await service.getCharacteristic(BLE_UART_RX_CHARACTERISTIC_UUID);
      bleTxCharRef.current = txChar;
      bleRxCharRef.current = rxChar;

      const decoder = new TextDecoder();
      txChar.addEventListener('characteristicvaluechanged', () => {
        const value = txChar.value;
        if (value) bufferRef.current += decoder.decode(value.buffer, { stream: true });
      });
      await txChar.startNotifications();

      setTransport('bluetooth');
      setMode('connected');
    } catch (err) {
      console.error('Telescope Bluetooth connect failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not pair over Bluetooth.');
      setMode('error');
    }
  }, []);

  const enableSimulator = useCallback(() => {
    setTransport('simulator');
    setMode('simulator');
    setErrorMessage(null);
    setPosition({ raHours: 12, decDeg: 45 }); // arbitrary starting target, near-zenith for most northern observers
    setTrackingRateState('sidereal'); // a mount is normally tracking sidereal once powered on/aligned
  }, []);

  // Sets the mount's tracking rate. Simulator: genuine internal state this
  // hook owns outright, so it's set with certainty. Real hardware: sends the
  // adapter's real protocol command for that rate — a no-op if the current
  // protocol has no documented command for it (trackingRateCommand returns
  // null/is undefined), which the UI should already be reflecting by
  // disabling that option rather than relying on this silent guard.
  const setTrackingRate = useCallback(
    (rate: TrackingRate) => {
      if (transport === 'simulator') {
        setTrackingRateState(rate);
        return;
      }
      if (mode !== 'connected') return;
      const cmd = TELESCOPE_PROTOCOLS[protocolId].trackingRateCommand?.(rate);
      if (!cmd) return;
      write(cmd);
      setTrackingRateState(rate);
    },
    [transport, mode, protocolId, write]
  );

  const slewTo = useCallback(
    (target: TelescopePosition, name?: string) => {
      setLastTarget(target);
      setLastTargetName(name ?? null);
      // Drift is meaningless across a slew boundary — the next idle sample
      // should compare against where the mount lands, not where it started.
      lastIdlePollRef.current = null;

      if (transport === 'simulator') {
        const start = position ?? target;
        setSlewStartDelta(angularSeparationDeg(start, target));
        const startTime = performance.now();
        const durationMs = 2500;
        setSlewing(true);
        setSimulatorEtaSeconds(durationMs / 1000);
        if (slewAnimationRef.current) cancelAnimationFrame(slewAnimationRef.current);
        const tick = (t: number) => {
          const progress = Math.min(1, (t - startTime) / durationMs);
          const eased = 1 - Math.pow(1 - progress, 3);
          setPosition({
            raHours: start.raHours + (target.raHours - start.raHours) * eased,
            decDeg: start.decDeg + (target.decDeg - start.decDeg) * eased,
          });
          if (progress < 1) {
            // Exact, not estimated — this hook owns the simulator's own
            // easing/duration, so remaining time is genuinely known here.
            setSimulatorEtaSeconds((durationMs * (1 - progress)) / 1000);
            slewAnimationRef.current = requestAnimationFrame(tick);
          } else {
            setSlewing(false);
            setSimulatorEtaSeconds(null);
            slewAnimationRef.current = null;
          }
        };
        slewAnimationRef.current = requestAnimationFrame(tick);
        return;
      }

      if (mode !== 'connected') return;
      const adapter = TELESCOPE_PROTOCOLS[protocolId];
      setSlewStartDelta(angularSeparationDeg(position ?? target, target));
      setSlewing(true);
      write(adapter.gotoCommand(target));

      clearIntervalRef();
      const slewStart = Date.now();
      intervalRef.current = setInterval(async () => {
        const pos = await requestPosition();
        if (pos) setPosition(pos);
        if ((pos && positionsClose(pos, target)) || Date.now() - slewStart > SLEW_TIMEOUT_MS) {
          setSlewing(false);
          setSlewStartDelta(null);
          clearIntervalRef();
          intervalRef.current = setInterval(() => {
            requestPosition().then((p) => {
              if (p) {
                setPosition(p);
                recordIdlePositionSample(p);
              }
            });
          }, POSITION_POLL_MS);
        }
      }, SLEW_POLL_MS);
    },
    [transport, mode, position, protocolId, write, requestPosition, clearIntervalRef, recordIdlePositionSample]
  );

  const stopSlew = useCallback(() => {
    if (slewAnimationRef.current) {
      cancelAnimationFrame(slewAnimationRef.current);
      slewAnimationRef.current = null;
    }
    setSlewing(false);
    setSimulatorEtaSeconds(null);
    setSlewStartDelta(null);
    if (transport !== 'simulator') {
      write(TELESCOPE_PROTOCOLS[protocolId].stopCommand);
    }
  }, [transport, protocolId, write]);

  useEffect(() => () => { disconnect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived fresh each render from real state above — not stored separately,
  // so there's no way for these to go stale relative to position/lastTarget.
  const targetDeltaDeg = position && lastTarget ? angularSeparationDeg(position, lastTarget) : null;
  // Which rates are actually selectable right now — real for the simulator
  // (all four, since this hook owns that state outright) and for real
  // hardware (only the ones the current protocol adapter genuinely
  // documents a command for). Empty, not guessed, while disconnected.
  const ALL_TRACKING_RATES: TrackingRate[] = ['sidereal', 'solar', 'lunar', 'stopped'];
  const supportedTrackingRates: TrackingRate[] =
    transport === 'simulator'
      ? ALL_TRACKING_RATES
      : mode === 'connected'
        ? ALL_TRACKING_RATES.filter((r) => TELESCOPE_PROTOCOLS[protocolId].trackingRateCommand?.(r) != null)
        : [];
  const slewProgressPercent =
    slewing && slewStartDelta && slewStartDelta > 0 && targetDeltaDeg !== null
      ? Math.min(100, Math.max(0, 100 * (1 - targetDeltaDeg / slewStartDelta)))
      : !slewing && lastTarget
        ? 100
        : null;

  return {
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
    stopSlew,
    // Real telemetry for TelemetryGauges — null wherever the real value
    // genuinely isn't known (e.g. ETA on real hardware), never a fabricated
    // placeholder standing in for it.
    lastTarget,
    lastTargetName,
    targetDeltaDeg,
    slewProgressPercent,
    etaSeconds: transport === 'simulator' ? simulatorEtaSeconds : null,
    driftRateArcsecPerSec,
    trackingRate,
    setTrackingRate,
    supportedTrackingRates,
  };
}

export type TelescopeConnection = ReturnType<typeof useTelescopeConnection>;
