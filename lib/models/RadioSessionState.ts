import mongoose, { Schema, type Document, type Model } from 'mongoose';

// A single persisted row recording which station Radio Central should
// resume on load, for every visitor — set by the admin's "Save session"
// action on a channel folder (ChannelFolderManager.tsx). Deliberately its
// own tiny singleton model rather than reusing RadioChannelFolder or
// AdminRadioStation: it only ever holds one row (key: 'default'), and has
// nothing to do with either of those documents' own data (see AGENTS.md —
// don't entangle with what's already working).
export interface RadioSessionStateDoc extends Document {
  key: string;
  savedStationId: string;
  updatedAt: Date;
}

const RadioSessionStateSchema = new Schema<RadioSessionStateDoc>({
  key: { type: String, required: true, unique: true, default: 'default' },
  savedStationId: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export default (mongoose.models.RadioSessionState as Model<RadioSessionStateDoc>) ||
  mongoose.model<RadioSessionStateDoc>('RadioSessionState', RadioSessionStateSchema);
