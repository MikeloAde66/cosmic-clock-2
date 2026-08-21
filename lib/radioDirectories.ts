// Open-access station directory fetchers — Radio-Browser and SomaFM are
// real, free, public, no-API-key-required directories, verified against
// their actual live endpoints while building this. Both return stream
// URLs meant to be handed straight to RadioPlayerContext's existing
// playStation flow (see components/radio/RadioPlayerContext.tsx) — this
// file intentionally has no audio-playback logic of its own; that engine
// already exists, works, and already has an AnalyserNode-driven visualizer
// wired up (PlayerSpectrum.tsx). A second parallel audio engine would just
// mean two competing <audio> elements.

export interface DirectoryStation {
  id: string;
  name: string;
  streamUrl: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
}

function mapRadioBrowserStations(stations: Array<Record<string, unknown>>): DirectoryStation[] {
  return stations
    .filter((s) => typeof s.url_resolved === 'string' && s.url_resolved)
    .map((s) => ({
      id: String(s.stationuuid),
      name: String(s.name),
      streamUrl: String(s.url_resolved),
      homepage: typeof s.homepage === 'string' ? s.homepage : undefined,
      favicon: typeof s.favicon === 'string' && s.favicon ? s.favicon : undefined,
      tags: typeof s.tags === 'string' ? s.tags : undefined,
      codec: typeof s.codec === 'string' ? s.codec : undefined,
      bitrate: typeof s.bitrate === 'number' ? s.bitrate : undefined,
    }));
}

// Radio-Browser (radio-browser.info) — url_resolved is already a direct,
// playable stream URL (that's what "resolved" means in their API), unlike
// SomaFM's playlist pointer files below.
export async function fetchRadioBrowserStations(tag = 'ambient'): Promise<DirectoryStation[]> {
  try {
    const res = await fetch(
      `https://de1.api.radio-browser.info/json/stations/bytag/${encodeURIComponent(tag)}?limit=12&order=votes&reverse=true`,
      { headers: { 'User-Agent': 'AiOneApp/1.0' } }
    );
    if (!res.ok) return [];
    const stations = (await res.json()) as Array<Record<string, unknown>>;
    return mapRadioBrowserStations(stations);
  } catch (err) {
    console.error('Error fetching Radio-Browser stations:', err);
    return [];
  }
}

// Powers the Radio tab's live search bar — queries Radio-Browser's global
// station directory by name in real time, letting a visitor find and tune
// into essentially any streamable station worldwide, not just this app's
// curated list. Only fires client-side once the query is a few characters
// long (see the debounce in RadioStreams.tsx) to avoid hammering the API
// on every keystroke.
export async function searchRadioBrowserStations(name: string, limit = 8): Promise<DirectoryStation[]> {
  try {
    const res = await fetch(
      `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(name)}&limit=${limit}&order=votes&reverse=true`,
      { headers: { 'User-Agent': 'AiOneApp/1.0' } }
    );
    if (!res.ok) return [];
    const stations = (await res.json()) as Array<Record<string, unknown>>;
    return mapRadioBrowserStations(stations);
  } catch (err) {
    console.error('Error searching Radio-Browser stations:', err);
    return [];
  }
}

// SomaFM support (fetchSomaFMChannels/resolveSomaFMStreamUrl) was built,
// verified, and then removed — SomaFM's Icecast relays enforce
// Referer/Origin-based anti-hotlinking, confirmed via a controlled test
// (identical 403 with and without crossOrigin="anonymous" on a plain
// <audio> element, while a server-side curl to the same URL always
// succeeds). That's a deliberate policy on SomaFM's end blocking any
// externally-embedded playback, not something fixable client-side —
// dropped rather than kept as permanently-broken dead code.

// AzuraCast — a self-hosted, open-source station server (Docker-deployed
// on whatever host the user runs it on; that deployment step is outside
// what this codebase or I can provision). This function is deliberately
// generic/parametrized rather than pointing at any specific domain — it
// only becomes real once a real AzuraCast instance's domain + station id
// are supplied, matching AzuraCast's documented public Now Playing API
// shape. Unlike Radio-Browser/SomaFM above, there's no live instance to
// verify this against yet.
export interface CustomStationStatus {
  stationName: string;
  isOnline: boolean;
  currentTrack: string;
  artist: string;
  artUrl: string;
  streamUrl: string;
}

export async function fetchCustomStationStatus(
  azuraCastDomain: string,
  stationId: string
): Promise<CustomStationStatus | null> {
  try {
    const res = await fetch(`https://${azuraCastDomain}/api/nowplaying/${encodeURIComponent(stationId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      stationName: data.station.name,
      isOnline: data.is_online,
      currentTrack: data.now_playing.song.title,
      artist: data.now_playing.song.artist,
      artUrl: data.now_playing.song.art,
      streamUrl: data.station.listen_url,
    };
  } catch (err) {
    console.error('Error fetching AzuraCast station status:', err);
    return null;
  }
}
