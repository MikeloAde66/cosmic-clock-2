import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type ModeTag = 'cosmic' | 'quantum' | 'synthesis';

export interface KnowledgeChunkDoc extends Document {
  mode_tag: ModeTag;
  source: string; // citation / title of the originating text
  text: string; // the chunk's raw content
  embedding: number[]; // Voyage voyage-3 output — 1024 dimensions
  createdAt: Date;
}

const KnowledgeChunkSchema = new Schema<KnowledgeChunkDoc>({
  mode_tag: { type: String, enum: ['cosmic', 'quantum', 'synthesis'], required: true, index: true },
  source: { type: String, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now },
});

// The `embedding` field also needs an Atlas Vector Search index named
// "vector_index" (numDimensions: 1024, similarity: cosine, path: "embedding")
// created in the Atlas UI or via createSearchIndex — a plain Mongoose index
// does not create that; see app/api/knowledge/ingest/route.ts for the
// programmatic attempt to create it on first ingest.

export default (mongoose.models.KnowledgeChunk as Model<KnowledgeChunkDoc>) ||
  mongoose.model<KnowledgeChunkDoc>('KnowledgeChunk', KnowledgeChunkSchema);
