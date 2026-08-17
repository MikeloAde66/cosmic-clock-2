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

// Display-only relabeling — CATEGORIES' own values still drive filtering
// (station.category === activeCategory) and every RadioStation's category
// field, so this only changes the filter button's rendered text, not the
// underlying matching logic. Categories not listed here render as-is.
export const CATEGORY_LABELS: Record<string, string> = {
  'VAULT STATIONS': 'STATIONS',
};

export interface OutkastLink {
  label: string;
  // Placeholder destinations — swap for the real URLs once they exist, same
  // convention as SiteFooter's SOCIAL_LINKS.
  href: string;
}

export interface OutkastComingSoon {
  label: string;
}

// OUTKAST isn't a station filter — it's a dropdown hub of community/social
// action gates, rendered as its own button alongside the category filters.
export const OUTKAST_LINKS: OutkastLink[] = [
  { label: 'Discord', href: 'https://discord.gg/your-invite' },
  { label: 'WhatsApp', href: 'https://wa.me/your-number' },
  { label: 'Spotify', href: 'https://open.spotify.com/your-profile' },
  { label: 'iTunes', href: 'https://music.apple.com/your-page' },
];

// No backend exists for any of these yet (no trivia UI, no scavenger/
// innovation-hunt/Astro Challenge feature anywhere in the app) — honest
// "coming soon" entries rather than fabricated working links.
export const OUTKAST_COMING_SOON: OutkastComingSoon[] = [
  { label: 'Trivia' },
  { label: 'Scavenger Hunt' },
  { label: 'Prototype Innovation Hunt' },
  { label: 'Astro Challenges' },
];

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
