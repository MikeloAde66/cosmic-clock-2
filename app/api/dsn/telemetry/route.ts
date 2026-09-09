import { XMLParser } from 'fast-xml-parser';

export const runtime = 'nodejs';

// NASA/JPL's real, public Deep Space Network status feed — the same one
// powering eyes.nasa.gov/dsn/dsn.html. Verified live and by hand (curl)
// before writing this: <dsn> contains <station>/<dish> as FLAT SIBLINGS in
// document order, not <dish> nested inside <station> — a dish belongs to
// whichever <station> most recently preceded it. preserveOrder:true keeps
// that order so attribution is correct; the default object mode would
// silently scramble it (station[] and dish[] would come back as two
// separate arrays with the station/dish relationship lost).
const DSN_FEED_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
const SPEED_OF_LIGHT_KM_S = 299_792.458;

// A handful of common spacecraft mnemonics this feed reports, mapped to
// their real full names for readability — verified against the feed's own
// live output, not guessed. Anything not in this list falls back to
// showing the raw mnemonic as-is rather than invent a name for it.
const SPACECRAFT_NAMES: Record<string, string> = {
  VGR1: 'Voyager 1',
  VGR2: 'Voyager 2',
  JWST: 'James Webb Space Telescope',
  MRO: 'Mars Reconnaissance Orbiter',
  M01O: 'Mars Odyssey',
  MVN: 'MAVEN',
  M20: 'Perseverance (Mars 2020)',
  MSL: 'Curiosity (MSL)',
  JNO: 'Juno',
  SOHO: 'SOHO',
  KPLO: 'Danuri (KPLO)',
  EMM: 'Hope (Emirates Mars Mission)',
  TESS: 'TESS',
  NHPC: 'New Horizons',
  LRO: 'Lunar Reconnaissance Orbiter',
};

// A plain index-signature interface can't also carry an explicit ':@'
// property of a different type (TS2411) — a type intersection sidesteps
// that since each half is checked independently.
type XmlNode = Record<string, XmlNode[] | undefined> & { ':@'?: Record<string, string> };

// Real one-way light time, computed from the feed's own real range figures
// (verified in km against Voyager 2's known real ~21.5-billion-km distance)
// — not the feed's own rtlt attribute, which is live-sampled "-1"
// (unpopulated) on every dish/target in practice.
function lightTimeSecondsFromRangeKm(rangeKm: number | null): number | null {
  if (rangeKm === null || rangeKm <= 0) return null;
  return rangeKm / SPEED_OF_LIGHT_KM_S;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface DsnLink {
  stationCode: string;
  stationName: string;
  dishName: string;
  dishAzimuthDeg: number | null;
  dishElevationDeg: number | null;
  spacecraftMnemonic: string;
  spacecraftName: string;
  direction: 'down' | 'up';
  band: string | null;
  dataRateBps: number | null;
  powerDbm: number | null;
  // Derived from real downlegRange/uplegRange (km), not the feed's own
  // rtlt field — see lightTimeSecondsFromRangeKm above.
  oneWayLightTimeSeconds: number | null;
}

export async function GET() {
  let xml: string;
  try {
    const res = await fetch(DSN_FEED_URL, { cache: 'no-store' });
    if (!res.ok) return Response.json({ error: 'DSN feed unavailable.' }, { status: 502 });
    xml = await res.text();
  } catch (err) {
    console.error('DSN feed fetch failed:', err);
    return Response.json({ error: 'DSN feed unavailable.' }, { status: 502 });
  }

  let ordered: XmlNode[];
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });
    const parsed = parser.parse(xml) as XmlNode[];
    const dsnRoot = parsed.find((n) => n.dsn)?.dsn;
    if (!dsnRoot) throw new Error('No <dsn> root in feed.');
    ordered = dsnRoot;
  } catch (err) {
    console.error('DSN feed XML parse failed:', err);
    return Response.json({ error: 'DSN feed returned unparseable data.' }, { status: 502 });
  }

  const links: DsnLink[] = [];
  let currentStation: { name: string; friendlyName: string } | null = null;

  for (const node of ordered) {
    if (node.station) {
      const attrs = node[':@'] ?? {};
      currentStation = { name: attrs.name ?? '', friendlyName: attrs.friendlyName ?? attrs.name ?? '' };
      continue;
    }
    if (node.dish && currentStation) {
      const dishAttrs = node[':@'] ?? {};
      const children = node.dish;

      // A dish typically tracks one spacecraft at a time — real range figures
      // live on the <target> child, keyed by spacecraft mnemonic so each
      // up/down signal for that spacecraft can look its light-time up here.
      const rangeByMnemonic = new Map<string, number | null>();
      for (const child of children) {
        if (!child.target) continue;
        const t = child[':@'] ?? {};
        const rangeKm = num(t.downlegRange) ?? num(t.uplegRange);
        rangeByMnemonic.set(t.name ?? '', rangeKm && rangeKm > 0 ? rangeKm : null);
      }

      for (const child of children) {
        const direction: 'down' | 'up' | null = child.downSignal ? 'down' : child.upSignal ? 'up' : null;
        if (!direction) continue;
        const sig = child[':@'] ?? {};
        if (sig.active !== 'true' || sig.signalType !== 'data' || !sig.spacecraft) continue;

        links.push({
          stationCode: currentStation.name,
          stationName: currentStation.friendlyName,
          dishName: dishAttrs.name ?? '',
          dishAzimuthDeg: num(dishAttrs.azimuthAngle),
          dishElevationDeg: num(dishAttrs.elevationAngle),
          spacecraftMnemonic: sig.spacecraft,
          spacecraftName: SPACECRAFT_NAMES[sig.spacecraft] ?? sig.spacecraft,
          direction,
          band: sig.band || null,
          dataRateBps: num(sig.dataRate),
          powerDbm: num(sig.power),
          oneWayLightTimeSeconds: lightTimeSecondsFromRangeKm(rangeByMnemonic.get(sig.spacecraft) ?? null),
        });
      }
    }
  }

  return Response.json({ links, fetchedAt: Date.now() });
}
