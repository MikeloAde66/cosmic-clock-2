import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { VaultDrawer } from '@/lib/vaultRegistry';

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
  createdAt: { type: Date, default: Date.now },
});

VaultProductSchema.index({ sku: 1, drawer: 1 }, { unique: true });

export default (mongoose.models.VaultProduct as Model<VaultProductDoc>) ||
  mongoose.model<VaultProductDoc>('VaultProduct', VaultProductSchema);
