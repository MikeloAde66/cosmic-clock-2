import dbConnect from '@/lib/dbConnect';
import RadioChannelFolder from '@/lib/models/RadioChannelFolder';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Records tracks that have ALREADY landed in Supabase Storage via the
// signed URLs from POST /api/admin/radio-channels/upload-url — mirrors
// app/api/vault/upload/route.ts's finalize step. Only ever sees small JSON
// (filenames/paths/sizes), never a file body.
interface FinalizedTrack {
  filename: string;
  storagePath: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }

  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: { folderId?: string; tracks?: FinalizedTrack[] };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { folderId, tracks } = body;
  if (typeof folderId !== 'string' || !folderId.trim()) {
    return new Response('folderId is required.', { status: 400 });
  }
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return new Response('At least one uploaded track is required.', { status: 400 });
  }
  for (const t of tracks) {
    if (typeof t?.filename !== 'string' || typeof t?.storagePath !== 'string' || typeof t?.sizeBytes !== 'number') {
      return new Response('Each track needs a filename, storagePath, and sizeBytes.', { status: 400 });
    }
  }

  try {
    await dbConnect();
    const newTracks = tracks.map((t) => ({
      filename: t.filename,
      storagePath: t.storagePath,
      sizeBytes: t.sizeBytes,
      ...(t.durationSeconds ? { durationSeconds: t.durationSeconds } : {}),
    }));

    const doc = await RadioChannelFolder.findByIdAndUpdate(
      folderId.trim(),
      { $push: { tracks: { $each: newTracks } }, $set: { updatedAt: new Date() } },
      { new: true }
    );
    if (!doc) return new Response('Folder not found.', { status: 404 });

    return Response.json({
      folder: {
        id: doc._id.toString(),
        name: doc.name,
        tracks: doc.tracks.map((t) => ({ id: t._id.toString(), filename: t.filename, sizeBytes: t.sizeBytes })),
      },
    });
  } catch (err) {
    console.error('Radio channel upload finalize error:', err);
    const message = err instanceof Error ? err.message : 'Failed to save uploaded tracks.';
    return new Response(message, { status: 500 });
  }
}
