// Real ASCOM Alpaca API v1 shapes (the published ASCOM Initiative REST
// spec — https://ascom-standards.org/api/), implemented from spec like
// this app's existing LX200/NexStar protocol layer (lib/telescopeProtocol.ts)
// already is, not adapted from a working codebase. There's no physical
// Alpaca device or simulator (e.g. ASCOM Remote Server / ConformU) in this
// environment to test against — treat this as unverified against real
// hardware until it's actually exercised against one.

// Every Alpaca response — GET or PUT — is wrapped in this real envelope.
export interface AlpacaResponse<T> {
  Value: T;
  ClientTransactionID: number;
  ServerTransactionID: number;
  ErrorNumber: number;
  ErrorMessage: string;
}

export interface AlpacaDeviceDescription {
  DeviceName: string;
  DeviceType: string;
  DeviceNumber: number;
  UniqueID: string;
}

// A discovered Alpaca server (one device might host several DeviceNumbers)
// — see app/api/alpaca/discover, which is the actual UDP broadcast/listen
// (server-side only; browsers have no raw UDP socket API at all, so this
// can't run client-side no matter how it's written).
export interface DiscoveredAlpacaServer {
  host: string;
  alpacaPort: number;
}

export interface TelescopeStatus {
  connected: boolean;
  rightAscensionHours: number;
  declinationDeg: number;
  azimuthDeg: number;
  altitudeDeg: number;
  slewing: boolean;
  tracking: boolean;
}
