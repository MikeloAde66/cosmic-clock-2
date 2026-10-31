import dbConnect from '@/lib/dbConnect';
import RadioChannelFolder from '@/lib/models/RadioChannelFolder';
import { getSupabaseAdmin, RADIO_CHANNELS_BUCKET } from '@/lib/supabaseAdmin';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';
import type { ChannelFolderRadioStation } from '@/lib/radioStations';

export const runtime = 'nodejs';

// Public: Radio Central merges these into its channel list for every
// visitor, same as /api/admin/radio-stations already does for admin-added
// live stations — only admins can create/rename/delete (see POST/PATCH/
// DELETE below), but anyone can tune in and play. Track filenames aren't
// secret, so they're included (for the admin folder-manager UI to render
// its file list with "X" delete buttons) without needing a separate
// admin-gated fetch.
export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json({ folders: [] });
  }
  try {
    await dbConnect();
    const docs = await RadioChannelFolder.find().sort({ createdAt: -1 }).lean();
    const folders = docs.map((d) => ({
      station: {
        kind: 'channel-folder' as const,
        id: `channel-${d._id}`,
        folderId: d._id.toString(),
        name: d.name,
        network: 'My Channels',
        tagline: `${d.tracks.length} track${d.tracks.length === 1 ? '' : 's'}`,
        genre: 'Custom',
        category: 'ALL CHANNELS',
        badge: d.badge,
        badgeColor: d.badgeColor,
      } satisfies ChannelFolderRadioStation,
      tracks: d.tracks.map((t) => ({ id: t._id.toString(), filename: t.filename, sizeBytes: t.sizeBytes })),
    }));
    return Response.json({ folders });
  } catch (err) {
    console.error('Radio channel folders list error:', err);
    return Response.json({ folders: [] });
  }
}

async function checkAdmin(request: Request) {
  try {
    await requireAdmin(request);
    return null;
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }
}

export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }
  const authError = await checkAdmin(request);
  if (authError) return authError;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return new Response('name is required.', { status: 400 });

  try {
    await dbConnect();
    const doc = await RadioChannelFolder.create({ name });
    return Response.json({
      folder: {
        id: doc._id.toString(),
        name: doc.name,
        badge: doc.badge,
        badgeColor: doc.badgeColor,
        tracks: [],
      },
    });
  } catch (err) {
    console.error('Radio channel folder create error:', err);
    const message = err instanceof Error ? err.message : 'Create failed.';
    return new Response(message, { status: 500 });
  }
}

// Rename only — track management goes through upload-url/upload/track
// routes, matching the one-route-per-concern convention Vault's own
// metadata/product/track routes already use.
export async function PATCH(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }
  const authError = await checkAdmin(request);
  if (authError) return authError;

  let body: { id?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }
  const { id } = body;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!id) return new Response('id is required.', { status: 400 });
  if (!name) return new Response('name is required.', { status: 400 });

  try {
    await dbConnect();
    const doc = await RadioChannelFolder.findByIdAndUpdate(id, { $set: { name, updatedAt: new Date() } }, { new: true });
    if (!doc) return new Response('Folder not found.', { status: 404 });
    return Response.json({ folder: { id: doc._id.toString(), name: doc.name } });
  } catch (err) {
    console.error('Radio channel folder rename error:', err);
    const message = err instanceof Error ? err.message : 'Rename failed.';
    return new Response(message, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }
  const authError = await checkAdmin(request);
  if (authError) return authError;

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }
  if (!body.id) return new Response('id is required.', { status: 400 });

  try {
    await dbConnect();
    const doc = await RadioChannelFolder.findByIdAndDelete(body.id);
    if (!doc) return new Response('Folder not found.', { status: 404 });

    // Best-effort storage cleanup — never blocks the delete response on it.
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY && doc.tracks.length > 0) {
      try {
        const admin = getSupabaseAdmin();
        await admin.storage.from(RADIO_CHANNELS_BUCKET).remove(doc.tracks.map((t) => t.storagePath));
      } catch (cleanupErr) {
        console.error('Radio channel folder storage cleanup error:', cleanupErr);
      }
    }

    return Response.json({ deleted: true, id: body.id });
  } catch (err) {
    console.error('Radio channel folder delete error:', err);
    const message = err instanceof Error ? err.message : 'Delete failed.';
    return new Response(message, { status: 500 });
  }
}
