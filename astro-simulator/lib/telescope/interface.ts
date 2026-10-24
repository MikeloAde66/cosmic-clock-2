// Placeholder for future telescope-mount control. v1 deliberately ships NO
// hardware control: Web Bluetooth is unavailable on iOS Safari, and mounts
// normally speak Wi-Fi (ASCOM Alpaca / INDI). A later version can implement
// this interface against an Alpaca or INDI HTTP bridge without touching the
// views.
export interface MountPosition {
  raHours: number;
  decDeg: number;
}

export interface TelescopeMount {
  readonly transport: 'alpaca' | 'indi';
  connect(endpoint: string): Promise<void>;
  disconnect(): Promise<void>;
  position(): Promise<MountPosition>;
  slewTo(target: MountPosition): Promise<void>;
  abortSlew(): Promise<void>;
}

/** Always rejects in v1. */
export function connectTelescope(): never {
  throw new Error('Telescope control is not implemented in Astro Simulator v1');
}
