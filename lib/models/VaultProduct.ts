import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { VaultDrawer, VaultVariantFulfillmentType, VaultVariantProductType } from '@/lib/vaultRegistry';

export interface VaultTrackSub {
  filename: string;
  // Object path inside the private Supabase 'vault' bucket, e.g.
  // "MUSIC/MUS-432-01/1723315200000-track-01.mp3" — not a public URL. The
  // API layer exchanges this for a short-lived signed download URL on read.
  storagePath: string;
  sizeBytes: number;
  durationSeconds?: number;
  // Relative rotation weight for radio queue generation — higher plays more
  // often. Absent/1 is normal weight; set via PATCH /api/radio/weights.
  weight?: number;
}

const VaultTrackSchema = new Schema<VaultTrackSub>(
  {
    filename: { type: String, required: true },
    storagePath: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSeconds: { type: Number },
    weight: { type: Number, default: 1 },
  },
  { _id: false }
);

export interface VaultProductVariantSub {
  id: string;
  listingTitle: string;
  productType: VaultVariantProductType;
  fulfillmentType: VaultVariantFulfillmentType;
  priceCents: number;
  inventoryCount?: number;
  isAvailable: boolean;
}

const VARIANT_PRODUCT_TYPES: VaultVariantProductType[] = [
  'physical_original',
  'limited_print',
  'digital_download',
  'non_exclusive_license',
  'exclusive_license',
  'streaming_only',
];
const VARIANT_FULFILLMENT_TYPES: VaultVariantFulfillmentType[] = ['shipment', 'digital_delivery', 'license_grant'];

const VaultProductVariantSchema = new Schema<VaultProductVariantSub>(
  {
    id: { type: String, required: true },
    listingTitle: { type: String, required: true },
    productType: { type: String, enum: VARIANT_PRODUCT_TYPES, required: true },
    fulfillmentType: { type: String, enum: VARIANT_FULFILLMENT_TYPES, required: true },
    priceCents: { type: Number, required: true },
    inventoryCount: { type: Number },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false }
);

export interface VaultProductDoc extends Document {
  sku: string;
  drawer: VaultDrawer;
  title: string;
  description: string;
  readmeGuide: string;
  createdAt: Date;
  // Every product is a "pack" of at least one track — a single-file upload
  // is just a pack with tracks.length === 1. Uploading again with the same
  // sku+drawer appends to this array rather than creating a new card.
  tracks: Types.DocumentArray<VaultTrackSub>;
  // Retail price for the public storefront, in cents. Only meaningful when
  // isPublished is true — a pack can carry a price while still unpublished
  // (e.g. being priced before launch).
  priceCents?: number;
  // Gates whether this pack is exposed via GET /api/vault/published (the
  // storefront's only vault-facing endpoint). Defaults to false so nothing
  // is public until an admin explicitly opts it in.
  isPublished: boolean;
  // Free-form labels for Cmd+K search — supplements sku/title/drawer rather
  // than replacing them as the categorization axis.
  tags?: string[];
  // Free-form key/value facts (e.g. { frequency: '432Hz', resolution: '4K' })
  // — not used by search or the storefront, just carried through for display.
  metadata?: Record<string, string | number | boolean>;
  // Optional — when present, GET /api/vault/published lists each available
  // variant as its own storefront listing instead of the pack's single
  // priceCents/isPublished pair. See lib/vaultRegistry.ts for the full
  // rationale (one master asset, several separately-priced/fulfilled
  // listings without duplicating the underlying files).
  productVariants?: Types.DocumentArray<VaultProductVariantSub>;
}

const VaultProductSchema = new Schema<VaultProductDoc>({
  sku: { type: String, required: true, index: true },
  drawer: {
    type: String,
    enum: ['ADMIN', 'MUSIC', 'ANIMATIONS', 'AUTOMATIONS', 'DEMOS', 'PROTOTYPES', 'DOCS', 'TEMPLATES', 'PLANNERS', 'PHOTOS'],
    required: true,
    index: true,
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  readmeGuide: { type: String, default: '' },
  tracks: { type: [VaultTrackSchema], default: [] },
  priceCents: { type: Number },
  isPublished: { type: Boolean, default: false, index: true },
  tags: { type: [String], default: [], index: true },
  metadata: { type: Schema.Types.Mixed },
  productVariants: { type: [VaultProductVariantSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

VaultProductSchema.index({ sku: 1, drawer: 1 }, { unique: true });

export default (mongoose.models.VaultProduct as Model<VaultProductDoc>) ||
  mongoose.model<VaultProductDoc>('VaultProduct', VaultProductSchema);
