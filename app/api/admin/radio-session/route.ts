import dbConnect from '@/lib/dbConnect';
import RadioSessionState from '@/lib/models/RadioSessionState';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Public: RadioPlayerContext reads this on every fresh page load to decide
// which station to prime into the bottom bar instead of the hardcoded
// 432Hz default — same "anyone can read, only admin can write" shape as
// /api/admin/radio-channels' GET.
export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json({ savedStationId: null });
  }
  try {
    await dbConnect();
    const doc = await RadioSessionState.findOne({ key: 'default' }).lean();
    return Response.json({ savedStationId: doc?.savedStationId ?? null });
  } catch (err) {
    console.error('Radio session state fetch error:', err);
    return Response.json({ savedStationId: null });
  }
}

// Admin-only: "Save session" in ChannelFolderManager.tsx — sets the station
// that should greet every visitor on next load, until saved again.
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

  const body = await request.json().catch(() => null);
  const stationId = typeof body?.stationId === 'string' ? body.stationId.trim() : '';
  if (!stationId) return new Response('stationId is required.', { status: 400 });

  try {
    await dbConnect();
    await RadioSessionState.findOneAndUpdate(
      { key: 'default' },
      { key: 'default', savedStationId: stationId, updatedAt: new Date() },
      { upsert: true }
    );
    return Response.json({ ok: true, savedStationId: stationId });
  } catch (err) {
    console.error('Radio session state save error:', err);
    return new Response('Failed to save session.', { status: 500 });
  }
}
