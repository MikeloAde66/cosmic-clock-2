import dbConnect from '@/lib/dbConnect';
import RadioChannelFolder from '@/lib/models/RadioChannelFolder';
import { getSupabaseAdmin, RADIO_CHANNELS_BUCKET } from '@/lib/supabaseAdmin';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Deletes a single track from a channel folder — the "X" button per file
// in the folder-manager UI. Removes the Storage object first (best-effort;
// doesn't block the Mongo removal on it) then pulls the subdocument.
export async function DELETE(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }

  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: { folderId?: string; trackId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }
  const { folderId, trackId } = body;
  if (!folderId || !trackId) {
    return new Response('folderId and trackId are required.', { status: 400 });
  }

  try {
    await dbConnect();
    const folder = await RadioChannelFolder.findById(folderId);
    if (!folder) return new Response('Folder not found.', { status: 404 });
    const track = folder.tracks.find((t) => t._id.toString() === trackId);
    if (!track) return new Response('Track not found.', { status: 404 });

    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        const admin = getSupabaseAdmin();
        await admin.storage.from(RADIO_CHANNELS_BUCKET).remove([track.storagePath]);
      } catch (cleanupErr) {
        console.error('Radio channel track storage cleanup error:', cleanupErr);
      }
    }

    const idx = folder.tracks.findIndex((t) => t._id.toString() === trackId);
    if (idx !== -1) folder.tracks.splice(idx, 1);
    folder.updatedAt = new Date();
    await folder.save();

    return Response.json({ deleted: true, folderId, trackId });
  } catch (err) {
    console.error('Radio channel track delete error:', err);
    const message = err instanceof Error ? err.message : 'Delete failed.';
    return new Response(message, { status: 500 });
  }
}
