import dbConnect from '@/lib/dbConnect';
import AdminRadioStation, { CURATABLE_CATEGORIES } from '@/lib/models/AdminRadioStation';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';
import type { LiveRadioStation } from '@/lib/radioStations';

// Public: Radio Central renders these alongside the curated RADIO_STATIONS
// list, so every visitor needs this list, not just admins. No secrets live
// on these docs — same shape as a curated station.
export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json({ stations: [] });
  }
  try {
    await dbConnect();
    const docs = await AdminRadioStation.find().sort({ createdAt: -1 }).lean();
    const stations: LiveRadioStation[] = docs.map((d) => ({
      kind: 'live',
      id: `admin-${d._id}`,
      name: d.name,
      network: d.network,
      tagline: d.tagline,
      genre: d.genre,
      category: d.category,
      streamUrl: d.streamUrl,
      badge: d.badge,
      badgeColor: d.badgeColor,
    }));
    return Response.json({ stations });
  } catch (err) {
    console.error('Admin radio stations list error:', err);
    return Response.json({ stations: [] });
  }
}

function validateBody(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const streamUrl = typeof body.streamUrl === 'string' ? body.streamUrl.trim() : '';
  if (!name || !CURATABLE_CATEGORIES.includes(category) || !/^https?:\/\/.+/.test(streamUrl)) {
    return null;
  }
  return {
    name,
    category,
    streamUrl,
    network: typeof body.network === 'string' && body.network.trim() ? body.network.trim() : 'Program Manager',
    tagline: typeof body.tagline === 'string' ? body.tagline.trim() : '',
    genre: typeof body.genre === 'string' ? body.genre.trim() : '',
    badge: typeof body.badge === 'string' && body.badge.trim() ? body.badge.trim().slice(0, 4) : '●',
    badgeColor: typeof body.badgeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.badgeColor) ? body.badgeColor : '#3a3a3a',
  };
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const fields = validateBody(body);
  if (!fields) {
    return new Response(
      `name, streamUrl (http/https), and category (one of ${CURATABLE_CATEGORIES.join(', ')}) are required.`,
      { status: 400 }
    );
  }

  try {
    await dbConnect();
    const doc = await AdminRadioStation.create(fields);
    const station: LiveRadioStation = {
      kind: 'live',
      id: `admin-${doc._id}`,
      name: doc.name,
      network: doc.network,
      tagline: doc.tagline,
      genre: doc.genre,
      category: doc.category,
      streamUrl: doc.streamUrl,
      badge: doc.badge,
      badgeColor: doc.badgeColor,
    };
    return Response.json({ station });
  } catch (err) {
    console.error('Admin radio station create error:', err);
    const message = err instanceof Error ? err.message : 'Create failed.';
    return new Response(message, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }
  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return new Response('id is required.', { status: 400 });

  const fields = validateBody(body);
  if (!fields) {
    return new Response(
      `name, streamUrl (http/https), and category (one of ${CURATABLE_CATEGORIES.join(', ')}) are required.`,
      { status: 400 }
    );
  }

  try {
    await dbConnect();
    const doc = await AdminRadioStation.findByIdAndUpdate(id, { $set: { ...fields, updatedAt: new Date() } }, { new: true });
    if (!doc) return new Response('Station not found.', { status: 404 });
    const station: LiveRadioStation = {
      kind: 'live',
      id: `admin-${doc._id}`,
      name: doc.name,
      network: doc.network,
      tagline: doc.tagline,
      genre: doc.genre,
      category: doc.category,
      streamUrl: doc.streamUrl,
      badge: doc.badge,
      badgeColor: doc.badgeColor,
    };
    return Response.json({ station });
  } catch (err) {
    console.error('Admin radio station update error:', err);
    const message = err instanceof Error ? err.message : 'Update failed.';
    return new Response(message, { status: 500 });
  }
}

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

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }
  if (!body.id) return new Response('id is required.', { status: 400 });

  try {
    await dbConnect();
    const doc = await AdminRadioStation.findByIdAndDelete(body.id);
    if (!doc) return new Response('Station not found.', { status: 404 });
    return Response.json({ deleted: true, id: body.id });
  } catch (err) {
    console.error('Admin radio station delete error:', err);
    const message = err instanceof Error ? err.message : 'Delete failed.';
    return new Response(message, { status: 500 });
  }
}

export const runtime = 'nodejs';
