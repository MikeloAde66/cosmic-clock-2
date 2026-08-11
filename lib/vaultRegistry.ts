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
  readmeGuide: string;
  dateAdded: string;
  // Every product is a pack of at least one uploaded track — a single-file
  // upload is just a one-track pack. There's no placeholder/empty state:
  // a product only exists once something has actually been uploaded to it.
  tracks: VaultTrack[];
}
