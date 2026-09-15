
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TELESCOPE_PROTOCOLS,
  BLE_UART_SERVICE_UUID,
  BLE_UART_RX_CHARACTERISTIC_UUID,
  BLE_UART_TX_CHARACTERISTIC_UUID,
  type TelescopeProtocolId,
  type TelescopePosition,
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

export function useTelescopeConnection() {
  const [protocolId, setProtocolId] = useState<TelescopeProtocolId>('lx200');
  const [mode, setMode] = useState<TelescopeConnectionMode>('disconnected');
  const [transport, setTransport] = useState<TelescopeTransportKind>(null);
  const [position, setPosition] = useState<TelescopePosition | null>(null);
  const [slewing, setSlewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState({ serial: false, bluetooth: false });

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
  }, [clearIntervalRef]);

  // Regular idle-rate position polling once a real transport is connected.
  useEffect(() => {
    if (mode !== 'connected' || transport === 'simulator') return;
    clearIntervalRef();
    intervalRef.current = setInterval(() => {
      requestPosition().then((pos) => {
        if (pos) setPosition(pos);
      });
    }, POSITION_POLL_MS);
    return clearIntervalRef;
  }, [mode, transport, requestPosition, clearIntervalRef]);

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
  }, []);

  const slewTo = useCallback(
    (target: TelescopePosition) => {
      if (transport === 'simulator') {
        const start = position ?? target;
        const startTime = performance.now();
        const durationMs = 2500;
        setSlewing(true);
        if (slewAnimationRef.current) cancelAnimationFrame(slewAnimationRef.current);
        const tick = (t: number) => {
          const progress = Math.min(1, (t - startTime) / durationMs);
          const eased = 1 - Math.pow(1 - progress, 3);
          setPosition({
            raHours: start.raHours + (target.raHours - start.raHours) * eased,
            decDeg: start.decDeg + (target.decDeg - start.decDeg) * eased,
          });
          if (progress < 1) {
            slewAnimationRef.current = requestAnimationFrame(tick);
          } else {
            setSlewing(false);
            slewAnimationRef.current = null;
          }
        };
        slewAnimationRef.current = requestAnimationFrame(tick);
        return;
      }

      if (mode !== 'connected') return;
      const adapter = TELESCOPE_PROTOCOLS[protocolId];
      setSlewing(true);
      write(adapter.gotoCommand(target));

      clearIntervalRef();
      const slewStart = Date.now();
      intervalRef.current = setInterval(async () => {
        const pos = await requestPosition();
        if (pos) setPosition(pos);
        if ((pos && positionsClose(pos, target)) || Date.now() - slewStart > SLEW_TIMEOUT_MS) {
          setSlewing(false);
          clearIntervalRef();
          intervalRef.current = setInterval(() => {
            requestPosition().then((p) => {
              if (p) setPosition(p);
            });
          }, POSITION_POLL_MS);
        }
      }, SLEW_POLL_MS);
    },
    [transport, mode, position, protocolId, write, requestPosition, clearIntervalRef]
  );

  const stopSlew = useCallback(() => {
    if (slewAnimationRef.current) {
      cancelAnimationFrame(slewAnimationRef.current);
      slewAnimationRef.current = null;
    }
    setSlewing(false);
    if (transport !== 'simulator') {
      write(TELESCOPE_PROTOCOLS[protocolId].stopCommand);
    }
  }, [transport, protocolId, write]);

  useEffect(() => () => { disconnect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  };
}

export type TelescopeConnection = ReturnType<typeof useTelescopeConnection>;
