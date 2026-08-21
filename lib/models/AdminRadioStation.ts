import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { CATEGORIES } from '@/lib/radioStations';

// Program Manager-curated live stations — additive to the hand-picked
// RADIO_STATIONS list in lib/radioStations.ts, not a replacement for it.
// That static list (including the 432Hz Vault station) stays exactly as it
// is; this collection is what lets an admin add/edit/remove *live* stream
// endpoints without a code deploy. Vault-kind stations (432Hz, the ads
// loop) have no equivalent here on purpose — they're wired to real Vault
// packs (sku/drawer), not arbitrary URLs, so they're out of scope for this
// endpoint-curation surface.
export interface AdminRadioStationDoc extends Document {
  name: string;
  network: string;
  tagline: string;
  genre: string;
  category: string;
  streamUrl: string;
  badge: string;
  badgeColor: string;
  createdAt: Date;
  updatedAt: Date;
}

// 'ALL CHANNELS' is a display filter, not a real category any station
// belongs to (see CATEGORIES' own comment in lib/radioStations.ts) —
// excluded here so a curated station is always sorted into a real tab.
const CURATABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'ALL CHANNELS');

const AdminRadioStationSchema = new Schema<AdminRadioStationDoc>({
  name: { type: String, required: true, trim: true },
  network: { type: String, default: 'Program Manager', trim: true },
  tagline: { type: String, default: '', trim: true },
  genre: { type: String, default: '', trim: true },
  category: { type: String, enum: CURATABLE_CATEGORIES, required: true },
  streamUrl: { type: String, required: true, trim: true },
  badge: { type: String, default: '●', trim: true },
  badgeColor: { type: String, default: '#3a3a3a', trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export { CURATABLE_CATEGORIES };

export default (mongoose.models.AdminRadioStation as Model<AdminRadioStationDoc>) ||
  mongoose.model<AdminRadioStationDoc>('AdminRadioStation', AdminRadioStationSchema);
