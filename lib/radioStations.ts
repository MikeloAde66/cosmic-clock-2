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

// Radio Hub is a relaxation/entertainment sanctuary, not a news dashboard —
// hard-news categories (the old CURRENT AFFAIRS tab) were dropped from this
// list entirely per that direction. BBC/NPR stay in RADIO_STATIONS below
// (still real, still playable, nothing deleted) but with no matching
// category here, they no longer get a dedicated tab — reachable only via
// ALL CHANNELS, i.e. deprioritized rather than removed.
export const CATEGORIES = ['ALL CHANNELS', 'LAUGHTER & FUN', 'HEARTY TALK', 'ANCIENT WISDOM', 'COSMIC CHILL'];

// Display-only relabeling — CATEGORIES' own values still drive filtering
// (station.category === activeCategory) and every RadioStation's category
// field, so this only changes the filter button's rendered text, not the
// underlying matching logic. Categories not listed here render as-is.
export const CATEGORY_LABELS: Record<string, string> = {};

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
  // Replaces the earlier WALM - Old Time Radio pick — that was a real,
  // working station, but a small independent Icecast server with genuine
  // intermittent uptime (confirmed: worked earlier this session, later
  // couldn't even be reached via curl). .977 Comedy runs on StreamTheWorld,
  // an established commercial CDN, real Access-Control-Allow-Origin: *,
  // and verified via an actual browser <audio> canplay event (not just a
  // curl 200 — that alone wasn't enough to catch SomaFM's hotlink block).
  {
    kind: 'live',
    id: 'rb-977-comedy',
    name: '.977 Comedy',
    network: 'Radio-Browser',
    tagline: 'Stand-up, sketch, and comedy talk, 24/7',
    genre: 'Comedy',
    category: 'LAUGHTER & FUN',
    streamUrl: 'http://26433.live.streamtheworld.com/977_COMEDY_SC',
    badge: '977',
    badgeColor: '#7c4a1e',
  },
  // Same StreamTheWorld network as .977 Comedy above — same
  // Access-Control-Allow-Origin: * headers, same verified-via-real-
  // browser-canplay reliability tier.
  {
    kind: 'live',
    id: 'rb-977-smoothjazz',
    name: '.977 Smooth Jazz',
    network: 'Radio-Browser',
    tagline: 'Smooth jazz, low and easy, around the clock',
    genre: 'Jazz / Chill',
    category: 'COSMIC CHILL',
    streamUrl: 'http://14543.live.streamtheworld.com/977_SMOOJAZZ_SC',
    badge: '977',
    badgeColor: '#7c4a1e',
  },
  // Hosted on Radiojar (an established streaming platform, not a small
  // indie server) — genuine history programming, a direct thematic fit
  // for Ancient Wisdom. Verified via real browser <audio> canplay.
  {
    kind: 'live',
    id: 'rb-historyradio',
    name: 'History Radio',
    network: 'Radio-Browser',
    tagline: 'Documentary-style history programming',
    genre: 'History / Lore',
    category: 'ANCIENT WISDOM',
    streamUrl: 'http://stream.radiojar.com/6bmecgg3wd5tv',
    badge: 'HST',
    badgeColor: '#5c4a2e',
  },
  {
    kind: 'vault',
    id: 'vault-432hz',
    name: '432Hz Cosmic Instrumental Stream',
    network: 'Cosmic Vault',
    tagline: 'Mastered 432Hz tuned instrumentals, continuous rotation',
    genre: 'Ambient / Instrumental',
    category: 'COSMIC CHILL',
    sku: 'MUS-432-01',
    drawer: 'MUSIC',
    badge: '432',
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
