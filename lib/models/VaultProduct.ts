import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { VaultDrawer } from '@/lib/vaultRegistry';

export interface VaultProductDoc extends Document {
  sku: string;
  drawer: VaultDrawer;
  title: string;
  description: string;
  // Object path inside the private Supabase 'vault' bucket, e.g.
  // "PODS/POD-XYZ-1723315200000-episode.mp3" — not a public URL. The API
  // layer exchanges this for a short-lived signed download URL on read.
  storagePath: string;
  readmeGuide: string;
  createdAt: Date;
}

const VaultProductSchema = new Schema<VaultProductDoc>({
  sku: { type: String, required: true, index: true },
  drawer: {
    type: String,
    enum: ['PODS', 'MUSIC', 'ANIMATIONS', 'PROTOTYPES', 'DOCS', 'TEMPLATES', 'PHOTOS'],
    required: true,
    index: true,
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  storagePath: { type: String, required: true },
  readmeGuide: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default (mongoose.models.VaultProduct as Model<VaultProductDoc>) ||
  mongoose.model<VaultProductDoc>('VaultProduct', VaultProductSchema);
