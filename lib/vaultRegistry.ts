export type VaultDrawer =
  | 'PODS'
  | 'MUSIC'
  | 'ANIMATIONS'
  | 'PROTOTYPES'
  | 'DOCS'
  | 'TEMPLATES'
  | 'PHOTOS';

export const VAULT_DRAWERS: VaultDrawer[] = [
  'PODS',
  'MUSIC',
  'ANIMATIONS',
  'PROTOTYPES',
  'DOCS',
  'TEMPLATES',
  'PHOTOS',
];

export interface VaultTrack {
  filename: string;
  fileUrl: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export interface VaultProduct {
  id: string;
  sku: string;
  drawer: VaultDrawer;
  title: string;
  description: string;
  // Only meaningful for the seed placeholders below (never a working link).
  // Real inventory items carry their file(s) in `tracks` instead — even a
  // single-file upload is a one-track pack, so every real product has a
  // uniform shape: one card, an inline expand to reach the actual file(s).
  fileUrl: string;
  readmeGuide: string;
  dateAdded: string;
  // True for the starter rows below — they describe the drawer but don't
  // point at a real uploaded file, so the UI shouldn't offer them for
  // download. Real uploads (via the Vault's "+ Upload File" flow) are
  // false/undefined and always carry a populated `tracks` array.
  isPlaceholder?: boolean;
  tracks?: VaultTrack[];
}

// One starter row per drawer so every section has something to look at
// before the first real upload. Replace/supersede these via the Vault's
// upload flow — they intentionally don't point at real files.
export const SEED_VAULT_INVENTORY: VaultProduct[] = [
  {
    id: 'D-01',
    sku: 'POD-S1E1',
    drawer: 'PODS',
    title: 'Screen Time & Cognitive Saturation',
    description: 'Multi-part broadcast episode series with raw audio & transcript stems.',
    fileUrl: '/vault/pods/screen-time-series.zip',
    readmeGuide: 'Unzip files into your local Pods directory. Load track manifest directly into Pods player.',
    dateAdded: '2026-08-01',
    isPlaceholder: true,
  },
  {
    id: 'D-02',
    sku: 'MUS-432-01',
    drawer: 'MUSIC',
    title: '432Hz High-Gain Instrumental Pack',
    description: 'Mastered 432Hz tuned beats optimized for background audio streams.',
    fileUrl: '/vault/music/432hz-instrumental-pack.zip',
    readmeGuide: 'Drag WAV files into DAW or add directly into your local playback folder.',
    dateAdded: '2026-08-02',
    isPlaceholder: true,
  },
  {
    id: 'D-03',
    sku: 'VIS-DWS-01',
    drawer: 'ANIMATIONS',
    title: 'Dancing with the Stars Pack',
    description: 'Custom Web Audio frequency-reactive canvas shaders and pulsar starburst visuals.',
    fileUrl: '/vault/animations/dancing-stars-pack.json',
    readmeGuide: 'Import JSON config in Pods > Visualizer Settings > Load Custom Skin.',
    dateAdded: '2026-08-10',
    isPlaceholder: true,
  },
  {
    id: 'D-04',
    sku: 'PRT-VQ-01',
    drawer: 'PROTOTYPES',
    title: 'VQ Demo Dashboard',
    description: 'Live interactive quantum simulation prototype interface.',
    fileUrl: '/vault/prototypes/vq-demo-dashboard.zip',
    readmeGuide: 'Run `npm install` then `npm run dev` to launch the interactive canvas locally.',
    dateAdded: '2026-08-04',
    isPlaceholder: true,
  },
  {
    id: 'D-05',
    sku: 'DOC-PHYS-01',
    drawer: 'DOCS',
    title: 'Quantum Physics Theory & Code Blueprint',
    description: 'Comprehensive research paper and code implementations for cosmic simulation calculations.',
    fileUrl: '/vault/docs/quantum-physics-theory.pdf',
    readmeGuide: 'Open PDF with any standard markdown or PDF viewer. Code examples included in Appendix B.',
    dateAdded: '2026-08-05',
    isPlaceholder: true,
  },
  {
    id: 'D-06',
    sku: 'TMP-HUD-01',
    drawer: 'TEMPLATES',
    title: 'Cosmic HUD UI Starter Kit',
    description: 'Next.js + Tailwind dark sci-fi UI component templates and navigation bars.',
    fileUrl: '/vault/templates/cosmic-hud-starter.zip',
    readmeGuide: 'Copy `/components` into your Next.js root folder. Includes pre-configured Tailwind theme.',
    dateAdded: '2026-08-06',
    isPlaceholder: true,
  },
  {
    id: 'D-07',
    sku: 'PHT-ART-01',
    drawer: 'PHOTOS',
    title: 'Fine Art High-Res Print Collection',
    description: 'Ultra-high resolution digital gallery prints (300 DPI, ready for 13x19 printing).',
    fileUrl: '/vault/photos/fine-art-prints.zip',
    readmeGuide: 'Color profile calibrated for Canon PIXMA PRO-200. Print without scaling for best canvas reproduction.',
    dateAdded: '2026-08-07',
    isPlaceholder: true,
  },
];
