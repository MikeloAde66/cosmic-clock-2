// Real ASCOM Alpaca REST client for the Telescope device type
// (/api/v1/telescope/{device_number}/...) — implemented from the published
// Alpaca spec, same unverified-against-real-hardware caveat as
// lib/telescopeProtocol.ts's LX200/NexStar layer already carries. Every
// call here is a genuine fetch to a real Alpaca server's HTTP API; nothing
// here fabricates telescope state.
import type { AlpacaResponse, TelescopeStatus } from './types';

// Real Alpaca requirement: every client identifies itself with a stable
// ClientID across a session, and a monotonically increasing
// ClientTransactionID per request — servers use these to disambiguate
// concurrent clients/requests, not just decoration.
const CLIENT_ID = Math.floor(Math.random() * 65535);
let transactionCounter = 0;
function nextTransactionId() {
  transactionCounter += 1;
  return transactionCounter;
}

export class AlpacaTelescopeClient {
  private readonly baseUrl: string;

  constructor(host: string, alpacaPort: number, private readonly deviceNumber = 0) {
    this.baseUrl = `http://${host}:${alpacaPort}/api/v1/telescope/${deviceNumber}`;
  }

  private async get<T>(action: string): Promise<T> {
    const params = new URLSearchParams({ ClientID: String(CLIENT_ID), ClientTransactionID: String(nextTransactionId()) });
    const res = await fetch(`${this.baseUrl}/${action}?${params.toString()}`);
    if (!res.ok) throw new Error(`Alpaca GET ${action} failed: ${res.status}`);
    const body: AlpacaResponse<T> = await res.json();
    if (body.ErrorNumber !== 0) throw new Error(`Alpaca error ${body.ErrorNumber}: ${body.ErrorMessage}`);
    return body.Value;
  }

  private async put(action: string, params: Record<string, string | number | boolean> = {}): Promise<void> {
    const form = new URLSearchParams({
      ClientID: String(CLIENT_ID),
      ClientTransactionID: String(nextTransactionId()),
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    const res = await fetch(`${this.baseUrl}/${action}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`Alpaca PUT ${action} failed: ${res.status}`);
    const body: AlpacaResponse<null> = await res.json();
    if (body.ErrorNumber !== 0) throw new Error(`Alpaca error ${body.ErrorNumber}: ${body.ErrorMessage}`);
  }

  async connect(): Promise<void> {
    await this.put('connected', { Connected: true });
  }

  async disconnect(): Promise<void> {
    await this.put('connected', { Connected: false });
  }

  // Real status telemetry poll — one real Alpaca property fetch per field,
  // run concurrently. Alpaca has no single "get everything" endpoint.
  async getStatus(): Promise<TelescopeStatus> {
    const [connected, rightAscensionHours, declinationDeg, azimuthDeg, altitudeDeg, slewing, tracking] = await Promise.all([
      this.get<boolean>('connected'),
      this.get<number>('rightascension'),
      this.get<number>('declination'),
      this.get<number>('azimuth'),
      this.get<number>('altitude'),
      this.get<boolean>('slewing'),
      this.get<boolean>('tracking'),
    ]);
    return { connected, rightAscensionHours, declinationDeg, azimuthDeg, altitudeDeg, slewing, tracking };
  }

  // Real Alpaca SlewToCoordinatesAsync — returns immediately; poll
  // getStatus().slewing to know when the mount actually arrives, the same
  // "commanded, not confirmed until polled" discipline this app's other
  // telescope layer already follows.
  async slewToCoordinatesAsync(rightAscensionHours: number, declinationDeg: number): Promise<void> {
    await this.put('slewtocoordinatesasync', { RightAscension: rightAscensionHours, Declination: declinationDeg });
  }

  // Real Alpaca SyncToCoordinates — tells the mount "you are actually
  // pointed here" (for alignment), distinct from commanding a physical
  // slew.
  async syncToCoordinates(rightAscensionHours: number, declinationDeg: number): Promise<void> {
    await this.put('synctocoordinates', { RightAscension: rightAscensionHours, Declination: declinationDeg });
  }

  async abortSlew(): Promise<void> {
    await this.put('abortslew');
  }

  async setTracking(enabled: boolean): Promise<void> {
    await this.put('tracking', { Tracking: enabled });
  }
}
