// Command builders/parsers for the two most common amateur telescope mount
// protocols. Both are real, publicly documented ASCII serial protocols
// (Meade's LX200 command set, and Celestron's NexStar Communication
// Protocol) — implemented here from spec, not adapted from any working
// codebase, since there's no physical mount in this environment to test
// against. Treat response *parsing* especially as best-effort until it's
// been exercised against a real device.

export type TelescopeProtocolId = 'lx200' | 'nexstar';

export interface TelescopePosition {
  raHours: number; // 0-24
  decDeg: number; // -90..90
}

export interface TelescopeProtocolAdapter {
  id: TelescopeProtocolId;
  label: string;
  // Default serial baud rate manufacturers ship these mounts configured for.
  baudRate: number;
  getPositionCommand: string;
  parsePositionResponse: (raw: string) => TelescopePosition | null;
  gotoCommand: (pos: TelescopePosition) => string;
  stopCommand: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function pad(n: number, width: number) {
  return String(Math.round(n)).padStart(width, '0');
}

// --- LX200 (Meade) -----------------------------------------------------
// Commands: ':' + code + params + '#'. Get-position replies terminate in
// '#'; RA as "HH:MM:SS#", Dec as "sDD*MM:SS#" (sign, degrees, arcmin,
// arcsec — '*' stands in for the degree glyph most firmwares actually send).

function lx200ParseRa(raw: string): number | null {
  const m = raw.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, h, mi, s] = m;
  return Number(h) + Number(mi) / 60 + Number(s) / 3600;
}

function lx200ParseDec(raw: string): number | null {
  const m = raw.match(/([+-])(\d{1,2})[*: ](\d{2})[:'](\d{2})/);
  if (!m) return null;
  const [, sign, d, mi, s] = m;
  const mag = Number(d) + Number(mi) / 60 + Number(s) / 3600;
  return sign === '-' ? -mag : mag;
}

function lx200FormatRa(raHours: number): string {
  const h = clamp(raHours, 0, 23.999722);
  const totalSeconds = Math.round(h * 3600);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${pad(hh, 2)}:${pad(mm, 2)}:${pad(ss, 2)}`;
}

function lx200FormatDec(decDeg: number): string {
  const d = clamp(decDeg, -90, 90);
  const sign = d < 0 ? '-' : '+';
  const totalSeconds = Math.round(Math.abs(d) * 3600);
  const dd = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${sign}${pad(dd, 2)}*${pad(mm, 2)}:${pad(ss, 2)}`;
}

export const LX200_ADAPTER: TelescopeProtocolAdapter = {
  id: 'lx200',
  label: 'Meade LX200',
  baudRate: 9600,
  getPositionCommand: ':GR#:GD#',
  parsePositionResponse: (raw) => {
    const raHours = lx200ParseRa(raw);
    const decDeg = lx200ParseDec(raw);
    if (raHours === null || decDeg === null) return null;
    return { raHours, decDeg };
  },
  gotoCommand: (pos) => `:Sr${lx200FormatRa(pos.raHours)}#:Sd${lx200FormatDec(pos.decDeg)}#:MS#`,
  stopCommand: ':Q#',
};

// --- NexStar (Celestron) -------------------------------------------------
// Single-letter passthrough commands, no leading colon. Position values are
// encoded as a fraction of a full revolution in 32-bit hex (high-precision
// variant): RA fraction = raHours / 24, Dec fraction = decDeg / 360 with
// negative declinations wrapped into the upper half of the circle (i.e.
// stored as decDeg + 360), matching the protocol's unsigned-angle encoding.

function nexstarToHex32(fraction: number): string {
  const wrapped = ((fraction % 1) + 1) % 1;
  const value = Math.round(wrapped * 0xffffffff) >>> 0;
  return value.toString(16).toUpperCase().padStart(8, '0');
}

function nexstarFromHex32(hex: string): number {
  return parseInt(hex, 16) / 0xffffffff;
}

function nexstarParsePosition(raw: string): TelescopePosition | null {
  const m = raw.match(/([0-9A-Fa-f]{8}),([0-9A-Fa-f]{8})/);
  if (!m) return null;
  const [, raHex, decHex] = m;
  const raFraction = nexstarFromHex32(raHex);
  let decFraction = nexstarFromHex32(decHex);
  if (decFraction > 0.5) decFraction -= 1; // upper half of the circle = negative Dec
  return { raHours: raFraction * 24, decDeg: decFraction * 360 };
}

export const NEXSTAR_ADAPTER: TelescopeProtocolAdapter = {
  id: 'nexstar',
  label: 'Celestron NexStar',
  baudRate: 9600,
  getPositionCommand: 'e', // high-precision GET-RA-DEC
  parsePositionResponse: nexstarParsePosition,
  gotoCommand: (pos) => {
    const raHex = nexstarToHex32(pos.raHours / 24);
    const decFraction = pos.decDeg < 0 ? (pos.decDeg + 360) / 360 : pos.decDeg / 360;
    const decHex = nexstarToHex32(decFraction);
    return `r${raHex},${decHex}`; // high-precision GOTO-RA-DEC
  },
  stopCommand: 'M',
};

export const TELESCOPE_PROTOCOLS: Record<TelescopeProtocolId, TelescopeProtocolAdapter> = {
  lx200: LX200_ADAPTER,
  nexstar: NEXSTAR_ADAPTER,
};

// De facto standard BLE UART bridge (Nordic UART Service) — what most
// BLE-to-serial telescope adapters that actually advertise over Bluetooth
// Low Energy use. IMPORTANT: this does NOT cover the classic-Bluetooth
// (SPP/RFCOMM) adapters bundled with most LX200/NexStar mounts (e.g.
// HC-05-based modules) — the Web Bluetooth API only speaks BLE GATT and
// cannot see classic-Bluetooth devices at all. Those mounts need the
// Web Serial (USB) path instead.
export const BLE_UART_SERVICE_UUID = '6e400001-b5a3-f393-e9a0-e50e24dcca9e';
export const BLE_UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e9a0-e50e24dcca9e'; // app -> device (write)
export const BLE_UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e9a0-e50e24dcca9e'; // device -> app (notify)
