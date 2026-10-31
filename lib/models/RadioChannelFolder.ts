import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

// Admin-only "channel folders" for Radio Central — a persistent, renameable
// bucket of uploaded audio (episodes, docs, specs, original songs) that
// plays as its own channel, replacing the old "+" button's ephemeral
// one-off upload/play. Deliberately its OWN model, not a reuse of
// VaultProduct's sku/drawer system: that system carries the Vault's
// separate PIN-gated security model and this feature has nothing to do
// with it (see AGENTS.md — don't entangle with what's already working).
export interface RadioChannelTrackSub {
  _id: Types.ObjectId;
  filename: string;
  // Path inside the radio-channels Supabase Storage bucket (see
  // lib/supabaseAdmin.ts's RADIO_CHANNELS_BUCKET) — bytes never pass
  // through this app's own request body, same signed-upload-URL pattern
  // the Vault uses (app/api/vault/upload-url, app/api/vault/upload).
  storagePath: string;
  sizeBytes: number;
  durationSeconds?: number;
  weight?: number;
  createdAt: Date;
}

export interface RadioChannelFolderDoc extends Document {
  name: string;
  badge: string;
  badgeColor: string;
  tracks: RadioChannelTrackSub[];
  createdAt: Date;
  updatedAt: Date;
}

const RadioChannelTrackSchema = new Schema<RadioChannelTrackSub>({
  filename: { type: String, required: true, trim: true },
  storagePath: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  durationSeconds: { type: Number },
  weight: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
});

const RadioChannelFolderSchema = new Schema<RadioChannelFolderDoc>({
  name: { type: String, required: true, trim: true },
  badge: { type: String, default: '♪', trim: true },
  badgeColor: { type: String, default: '#7c3aed', trim: true },
  tracks: { type: [RadioChannelTrackSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default (mongoose.models.RadioChannelFolder as Model<RadioChannelFolderDoc>) ||
  mongoose.model<RadioChannelFolderDoc>('RadioChannelFolder', RadioChannelFolderSchema);
