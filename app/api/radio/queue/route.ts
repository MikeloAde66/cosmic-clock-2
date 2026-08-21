import dbConnect from '@/lib/dbConnect';
import VaultProduct, { type VaultTrackSub } from '@/lib/models/VaultProduct';
import AdminRadioStation from '@/lib/models/AdminRadioStation';
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

// The pack that supplies ad/station-ID breaks for MUSIC-drawer stations —
// the same Vault pack the curated "Commercials & Ads Loop" station itself
// plays from. Interleaved into music queues, not applied to that station.
const AD_BREAK_SKU = 'Anime-radio-01';
const AD_BREAK_DRAWER = 'ANIMATIONS';
const TRACKS_PER_AD_BREAK = 3;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stationId = url.searchParams.get('station');
  const countParam = url.searchParams.get('count');
  // Fallback for stations found via the live Radio-Browser search bar
  // (RadioStreams.tsx) rather than the curated RADIO_STATIONS list below —
  // the client already knows the real streamUrl from that search result
  // (Radio-Browser's own url_resolved), so when the id isn't a curated
  // station, this echoes it back in the same {kind:'live', streamUrl}
  // shape rather than 404ing. Curated stations never hit this path: their
  // id always matches RADIO_STATIONS.find below first.
  const fallbackStreamUrl = url.searchParams.get('streamUrl');
  const fallbackName = url.searchParams.get('name');

  const station = RADIO_STATIONS.find((s) => s.id === stationId);
  if (!station) {
    // Program Manager-curated stations (see /api/admin/radio-stations) —
    // resolved server-side from Mongo rather than trusting a client-
    // supplied streamUrl, same integrity guarantee curated stations get.
    if (stationId?.startsWith('admin-') && process.env.MONGODB_URI) {
      try {
        await dbConnect();
        const doc = await AdminRadioStation.findById(stationId.slice('admin-'.length)).lean();
        if (doc) {
          const adminStation = {
            kind: 'live' as const,
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
          return Response.json({ station: adminStation, kind: 'live', streamUrl: doc.streamUrl });
        }
      } catch (err) {
        console.error('Admin radio station lookup error:', err);
      }
    }
    if (stationId && fallbackStreamUrl) {
      const adHocStation = {
        kind: 'live' as const,
        id: stationId,
        name: fallbackName || 'Live Station',
        network: 'Radio-Browser',
        tagline: 'Found via live search',
        genre: '',
        category: 'ALL CHANNELS',
        streamUrl: fallbackStreamUrl,
        badge: '●',
        badgeColor: '#3a3a3a',
      };
      return Response.json({ station: adHocStation, kind: 'live', streamUrl: fallbackStreamUrl });
    }
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
    const musicOrdered = buildQueue(doc.tracks, count, (t: VaultTrackSub) => t.weight ?? 1);

    // Interleave ad/station-ID breaks for music stations only — the ads
    // station itself shouldn't get ads spliced into its own ad rotation,
    // and this quietly no-ops if the ad pack is missing or empty.
    let sequence: { track: VaultTrackSub; isAd: boolean }[] = musicOrdered.map((t) => ({ track: t, isAd: false }));
    if (station.drawer === 'MUSIC') {
      const adDoc = await VaultProduct.findOne({ sku: AD_BREAK_SKU, drawer: AD_BREAK_DRAWER }).lean();
      if (adDoc && adDoc.tracks.length > 0) {
        const withAds: { track: VaultTrackSub; isAd: boolean }[] = [];
        musicOrdered.forEach((t, i) => {
          withAds.push({ track: t, isAd: false });
          if ((i + 1) % TRACKS_PER_AD_BREAK === 0) {
            withAds.push({ track: weightedRandomPick(adDoc.tracks, (a: VaultTrackSub) => a.weight ?? 1), isAd: true });
          }
        });
        sequence = withAds;
      }
    }

    const admin = getSupabaseAdmin();
    const tracks = await Promise.all(
      sequence.map(async ({ track: t, isAd }, i) => {
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
          isAd,
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
