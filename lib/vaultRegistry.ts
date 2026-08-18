export type VaultDrawer =
  // Protected drawer for system credentials, API stack documentation, bug
  // fixes, terms, readmes, deployment specs, and security firewalls — not
  // a general-purpose category, and unrelated to the sidebar's PodsModule
  // audio/podcast hub tab.
  | 'ADMIN'
  | 'MUSIC'
  | 'ANIMATIONS'
  | 'AUTOMATIONS'
  | 'DEMOS'
  | 'PROTOTYPES'
  | 'DOCS'
  | 'TEMPLATES'
  | 'PLANNERS'
  | 'PHOTOS'
  // Not a real VaultProduct/track-pack category like the others above —
  // VaultProduct requires at least one uploaded track and has no
  // Printful/Gelato-aware fulfillment type, neither of which fits physical
  // apparel. This drawer instead renders the existing, real
  // ProductsStorefront (its own catalog, cart, and checkout/fulfillment
  // path, unchanged) inside the Vault shell — see CosmicVaultAuth's
  // selectedCategory === 'MERCH' branch.
  | 'MERCH';

export const VAULT_DRAWERS: VaultDrawer[] = [
  'ADMIN',
  'MUSIC',
  'ANIMATIONS',
  'AUTOMATIONS',
  'DEMOS',
  'PROTOTYPES',
  'DOCS',
  'TEMPLATES',
  'PLANNERS',
  'PHOTOS',
  'MERCH',
];

export interface VaultTrack {
  filename: string;
  fileUrl: string;
  sizeBytes: number;
  durationSeconds?: number;
  weight?: number;
}

// A single Vault master item (e.g. one original painting, one track) can be
// sold as several distinct storefront listings without duplicating the
// underlying files — a physical original AND a digital license from the
// same source, each separately priced and fulfilled. Optional and purely
// additive: a pack with no variants still sells as one listing via its own
// priceCents/isPublished, exactly as before.
export type VaultVariantProductType =
  | 'physical_original'
  | 'limited_print'
  | 'digital_download'
  | 'non_exclusive_license'
  | 'exclusive_license'
  | 'streaming_only';

// Drives checkout/webhook routing — shipment gets a real address collected
// and is fulfilled manually by the seller (a one-of-a-kind original isn't
// something Printful/Gelato can print on demand); digital_delivery and
// license_grant both skip physical fulfillment entirely.
export type VaultVariantFulfillmentType = 'shipment' | 'digital_delivery' | 'license_grant';

export interface VaultProductVariant {
  // Stable within the pack — not globally unique on its own (composite with
  // the pack's own sku+drawer to form a storefront-facing product id).
  id: string;
  listingTitle: string;
  productType: VaultVariantProductType;
  fulfillmentType: VaultVariantFulfillmentType;
  priceCents: number;
  // Absent/undefined means unlimited (the normal case for digital variants).
  // Set for physical/limited variants — a 1-of-1 original uses 1.
  inventoryCount?: number;
  isAvailable: boolean;
}

export interface VaultProduct {
  id: string;
  sku: string;
  drawer: VaultDrawer;
  title: string;
  description: string;
  readmeGuide: string;
  dateAdded: string;
  // Usually at least one uploaded track (a single-file upload is just a
  // one-track pack), but can start empty — POST /api/vault/product's
  // "+ New Pack" flow reserves a title/sku/drawer first, with tracks added
  // afterward via the resulting card's own "+ Add Track".
  tracks: VaultTrack[];
  priceCents?: number;
  isPublished?: boolean;
  tags?: string[];
  metadata?: Record<string, string | number | boolean>;
  productVariants?: VaultProductVariant[];
}

// Public-facing shape returned by GET /api/vault/published — no storage
// internals (track filenames, signed URLs) leak into this, since that
// endpoint is reachable by anyone browsing the storefront, not just admins.
// One row per available variant when a pack has productVariants defined,
// otherwise one row for the pack's own single priceCents listing.
export interface PublishedVaultProduct {
  id: string;
  sku: string;
  drawer: VaultDrawer;
  title: string;
  description: string;
  priceCents: number;
  variantId?: string;
  productType?: VaultVariantProductType;
  fulfillmentType?: VaultVariantFulfillmentType;
}
