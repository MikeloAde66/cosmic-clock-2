import dbConnect from '@/lib/dbConnect';
import KnowledgeChunk, { type ModeTag } from '@/lib/models/KnowledgeChunk';
import { chunkText } from '@/lib/chunkText';
import { embedTexts } from '@/lib/voyage';

export const runtime = 'nodejs';

const VALID_MODE_TAGS: ModeTag[] = ['cosmic', 'quantum', 'synthesis'];

export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured yet.', { status: 500 });
  }
  if (!process.env.VOYAGE_API_KEY) {
    return new Response('VOYAGE_API_KEY is not configured yet.', { status: 500 });
  }

  const { mode_tag, source, text } = (await request.json()) as {
    mode_tag?: string;
    source?: string;
    text?: string;
  };

  if (!mode_tag || !VALID_MODE_TAGS.includes(mode_tag as ModeTag)) {
    return new Response(`mode_tag must be one of: ${VALID_MODE_TAGS.join(', ')}`, { status: 400 });
  }
  if (!source?.trim()) {
    return new Response('source is required (citation/title of the text).', { status: 400 });
  }
  if (!text?.trim()) {
    return new Response('text is required.', { status: 400 });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return new Response('No chunkable content found in text.', { status: 400 });
  }

  try {
    const mongoose = await dbConnect();
    const embeddings = await embedTexts(chunks, 'document');

    await ensureVectorIndex(mongoose);

    const docs = chunks.map((chunk, i) => ({
      mode_tag: mode_tag as ModeTag,
      source: source.trim(),
      text: chunk,
      embedding: embeddings[i],
    }));

    await KnowledgeChunk.insertMany(docs);

    return Response.json({ ingested: docs.length, source: source.trim(), mode_tag });
  } catch (err) {
    console.error('Knowledge ingest error:', err);
    const message = err instanceof Error ? err.message : 'Ingest failed.';
    return new Response(message, { status: 500 });
  }
}

// Best-effort: create the Atlas Vector Search index on first ingest if it
// doesn't exist yet. Requires an Atlas cluster (M10+, or M0 with the
// Search Nodes feature) — silently no-ops on failure so a missing/duplicate
// index never blocks ingestion. If this fails, create the index manually in
// the Atlas UI: Search > Create Search Index > Vector Search, name
// "vector_index", path "embedding", numDimensions 1024, similarity "cosine".
async function ensureVectorIndex(mongoose: typeof import('mongoose')) {
  try {
    const collection = mongoose.connection.collection('knowledgechunks');
    const existing = await collection.listSearchIndexes().toArray();
    if (existing.some((idx) => idx.name === 'vector_index')) return;

    await collection.createSearchIndex({
      name: 'vector_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: 1024, similarity: 'cosine' },
          { type: 'filter', path: 'mode_tag' },
        ],
      },
    });
  } catch (err) {
    console.warn('Could not auto-create vector_index (create it manually in Atlas if needed):', err);
  }
}
