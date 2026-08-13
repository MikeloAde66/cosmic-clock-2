import type { VaultDrawer } from './vaultRegistry';

// Placed in lib/ alongside radioStations.ts, vaultRegistry.ts, etc. rather
// than a separate types/ directory, to match this repo's existing
// convention of colocating a feature's data with its type.
export interface GlobeMarker {
  id: string;
  title: string;
  type: 'radio' | 'vault';
  lat: number;
  lng: number;
  color: string;
  // type: 'radio' — references an id in RADIO_STATIONS (lib/radioStations.ts).
  stationId?: string;
  // type: 'vault' — the drawer to preview/jump into. drawerSku is optional
  // and unused today (no marker points at one specific pack); the preview
  // card shows an aggregate file count across the whole drawer instead,
  // which stays correct as packs are added/removed/renamed.
  drawer?: VaultDrawer;
  drawerSku?: string;
}

const RADIO_COLOR = '#00F0FF';
const VAULT_COLOR = '#FF0055';

// Curated, not auto-generated — same convention as RADIO_STATIONS. Radio
// markers reference a real id in RADIO_STATIONS; the lat/lng for the two
// live-broadcast stations is their real network HQ, while the four
// Vault-sourced stations (and the Vault drawer markers) have no inherent
// geography, so their placement is a themed/decorative approximation.
export const GLOBE_NODES: GlobeMarker[] = [
  { id: 'bbc-world', title: 'BBC World Service', type: 'radio', stationId: 'bbc-world', lat: 51.5074, lng: -0.1278, color: RADIO_COLOR },
  { id: 'npr-news', title: 'NPR News', type: 'radio', stationId: 'npr-news', lat: 38.9072, lng: -77.0369, color: RADIO_COLOR },
  { id: 'vault-432hz', title: '432Hz Cosmic Instrumental Stream', type: 'radio', stationId: 'vault-432hz', lat: 34.8697, lng: -111.761, color: RADIO_COLOR },
  { id: 'vault-neosoul', title: 'Neo Soul Lounge', type: 'radio', stationId: 'vault-neosoul', lat: 29.9511, lng: -90.0715, color: RADIO_COLOR },
  { id: 'vault-jazzfusion', title: 'Jazz Fusion Hub', type: 'radio', stationId: 'vault-jazzfusion', lat: 40.7128, lng: -74.006, color: RADIO_COLOR },
  { id: 'vault-ads', title: 'Commercials & Ads Loop', type: 'radio', stationId: 'vault-ads', lat: 34.0522, lng: -118.2437, color: RADIO_COLOR },

  { id: 'vault-drawer-music', title: 'Music Drawer', type: 'vault', drawer: 'MUSIC', lat: 36.1627, lng: -86.7816, color: VAULT_COLOR },
  { id: 'vault-drawer-animations', title: 'Animations Drawer', type: 'vault', drawer: 'ANIMATIONS', lat: 35.6762, lng: 139.6503, color: VAULT_COLOR },
  { id: 'vault-drawer-prototypes', title: 'Prototypes Drawer', type: 'vault', drawer: 'PROTOTYPES', lat: 37.7749, lng: -122.4194, color: VAULT_COLOR },
  { id: 'vault-drawer-templates', title: 'Templates Drawer', type: 'vault', drawer: 'TEMPLATES', lat: 52.52, lng: 13.405, color: VAULT_COLOR },
];
