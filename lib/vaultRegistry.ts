export type VaultDrawer =
  // Protected drawer for system credentials, API stack documentation, bug
  // fixes, terms, readmes, deployment specs, and security firewalls — not
  // a general-purpose category, and unrelated to the sidebar's PodsModule
  // audio/podcast hub tab.
  | 'ADMIN'
  | 'MUSIC'
  | 'ANIMATIONS'
  | 'PROTOTYPES'
  | 'DOCS'
  | 'TEMPLATES'
  | 'PHOTOS';

export const VAULT_DRAWERS: VaultDrawer[] = [
  'ADMIN',
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
  weight?: number;
}

export interface VaultProduct {
  id: string;
  sku: string;
  drawer: VaultDrawer;
  title: string;
  description: string;
  readmeGuide: string;
  dateAdded: string;
  // Every product is a pack of at least one uploaded track — a single-file
  // upload is just a one-track pack. There's no placeholder/empty state:
  // a product only exists once something has actually been uploaded to it.
  tracks: VaultTrack[];
}
