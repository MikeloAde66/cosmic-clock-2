import type { VaultDrawer } from '@/lib/vaultRegistry';

interface BaseStation {
  id: string;
  name: string;
  network: string;
  tagline: string;
  genre: string;
  category: string;
  badge: string;
  badgeColor: string;
}

export interface LiveRadioStation extends BaseStation {
  kind: 'live';
  streamUrl: string;
}

export interface VaultRadioStation extends BaseStation {
  kind: 'vault';
  // Identifies the Vault pack this station's queue is built from.
  sku: string;
  drawer: VaultDrawer;
}

export type RadioStation = LiveRadioStation | VaultRadioStation;

export const CATEGORIES = ['ALL', 'CURRENT AFFAIRS', 'VAULT STATIONS'];

// Curated, not auto-generated: hand-mapped to whichever real Vault packs
// currently hold this content. If a pack's sku changes (re-uploaded under a
// new sku) or a new themed station is wanted, add/edit an entry here.
export const RADIO_STATIONS: RadioStation[] = [
  {
    kind: 'live',
    id: 'bbc-world',
    name: 'BBC World Service',
    network: 'BBC',
    tagline: 'Global News & Analysis',
    genre: 'News / Current Affairs',
    category: 'CURRENT AFFAIRS',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    badge: 'BBC',
    badgeColor: '#bb1919',
  },
  {
    kind: 'live',
    id: 'npr-news',
    name: 'NPR News',
    network: 'NPR',
    tagline: 'National Public Radio Live',
    genre: 'Public Radio / Talk',
    category: 'CURRENT AFFAIRS',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
    badge: 'NPR',
    badgeColor: '#1b3668',
  },
  {
    kind: 'vault',
    id: 'vault-432hz',
    name: '432Hz Cosmic Instrumental Stream',
    network: 'Cosmic Vault',
    tagline: 'Mastered 432Hz tuned instrumentals, continuous rotation',
    genre: 'Ambient / Instrumental',
    category: 'VAULT STATIONS',
    sku: 'MUS-432-01',
    drawer: 'MUSIC',
    badge: '432',
    badgeColor: '#3a3a3a',
  },
  {
    kind: 'vault',
    id: 'vault-neosoul',
    name: 'Neo Soul Lounge',
    network: 'Cosmic Vault',
    tagline: 'Neo soul & fusion beats from the Vault',
    genre: 'Neo Soul',
    category: 'VAULT STATIONS',
    sku: 'MUS-neosoul-01',
    drawer: 'MUSIC',
    badge: 'NS',
    badgeColor: '#3a3a3a',
  },
  {
    kind: 'vault',
    id: 'vault-jazzfusion',
    name: 'Jazz Fusion Hub',
    network: 'Cosmic Vault',
    tagline: 'Jazz fusion tracks from the Vault',
    genre: 'Jazz Fusion',
    category: 'VAULT STATIONS',
    sku: 'MUS-432-05',
    drawer: 'MUSIC',
    badge: 'JZ',
    badgeColor: '#3a3a3a',
  },
  {
    kind: 'vault',
    id: 'vault-ads',
    name: 'Commercials & Ads Loop',
    network: 'Cosmic Vault',
    tagline: 'Ad/ID rotation pulled from the Vault',
    genre: 'Ads / IDs',
    category: 'VAULT STATIONS',
    sku: 'Anime-radio-01',
    drawer: 'ANIMATIONS',
    badge: 'AD',
    badgeColor: '#3a3a3a',
  },
];
