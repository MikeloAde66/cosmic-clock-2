import dbConnect from '@/lib/dbConnect';
import VaultProduct, { type VaultTrackSub } from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { RADIO_STATIONS } from '@/lib/radioStations';

export const runtime = 'nodejs';

// Efraimidis-Spirakis weighted shuffle: each item gets a random key raised
// to 1/weight, then sorted descending — higher weight biases toward the
// front without ever guaranteeing order (still feels shuffled).
function weightedShuffle<T>(items: T[], weightOf: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(Math.random(), 1 / Math.max(weightOf(item), 0.0001)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}

function weightedRandomPick<T>(items: T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, i) => sum + Math.max(weightOf(i), 0.0001), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= Math.max(weightOf(item), 0.0001);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// A single weighted pass covers every track once (normal station shuffle).
// A `count` beyond the track total extends with weighted-random-with-
// replacement draws — what a continuous ad rotation loop needs, favoring
// higher-weighted tracks without ever excluding the low-weight ones.
function buildQueue<T>(items: T[], count: number, weightOf: (item: T) => number): T[] {
  const shuffled = weightedShuffle(items, weightOf);
  if (count <= shuffled.length) return shuffled.slice(0, count);
  const queue = [...shuffled];
  while (queue.length < count) {
    queue.push(weightedRandomPick(items, weightOf));
  }
  return queue;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stationId = url.searchParams.get('station');
  const countParam = url.searchParams.get('count');

  const station = RADIO_STATIONS.find((s) => s.id === stationId);
  if (!station) {
    return new Response(`Unknown station. Valid ids: ${RADIO_STATIONS.map((s) => s.id).join(', ')}`, { status: 404 });
  }

  if (station.kind === 'live') {
    return Response.json({ station, kind: 'live', streamUrl: station.streamUrl });
  }

  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('Vault backend is not configured.', { status: 500 });
  }

  try {
    await dbConnect();
    const doc = await VaultProduct.findOne({ sku: station.sku, drawer: station.drawer }).lean();
    if (!doc || doc.tracks.length === 0) {
      return Response.json({ station, kind: 'vault', tracks: [] });
    }

    const count = countParam ? Math.max(1, Math.min(500, parseInt(countParam, 10))) : doc.tracks.length;
    const ordered = buildQueue(doc.tracks, count, (t: VaultTrackSub) => t.weight ?? 1);

    const admin = getSupabaseAdmin();
    const tracks = await Promise.all(
      ordered.map(async (t, i) => {
        const { data: signed, error } = await admin.storage
          .from(VAULT_BUCKET)
          .createSignedUrl(t.storagePath, 6 * 60 * 60); // 6 hours — a queue can be listened to for a while
        return {
          // Positional id, not the track's identity — the same track can
          // legitimately appear more than once in a rotation-style queue.
          queueIndex: i,
          filename: t.filename,
          fileUrl: error ? '' : signed.signedUrl,
          durationSeconds: t.durationSeconds,
          weight: t.weight ?? 1,
        };
      })
    );

    return Response.json({ station, kind: 'vault', tracks });
  } catch (err) {
    console.error('Radio queue error:', err);
    const message = err instanceof Error ? err.message : 'Failed to build queue.';
    return new Response(message, { status: 500 });
  }
}
