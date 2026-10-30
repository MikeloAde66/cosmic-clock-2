// Shared by components/radio/RadioCentralConsoleView.tsx (Upload Audio's
// Internet Archive loader) and components/PodsModule.tsx (Studio One's
// Internet Archive embed support) — kept in one place so the
// identifier-parsing regex doesn't drift between the two call sites.

export function extractIdentifier(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/[/:]/.test(trimmed)) return trimmed; // a bare item id, e.g. "rosen"
  const match = trimmed.match(/archive\.org\/(?:details|download)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

export function buildArchiveEmbedUrl(identifier: string): string {
  return `https://archive.org/embed/${encodeURIComponent(identifier)}`;
}

export interface ArchiveItemInfo {
  title: string;
  creator: string;
}

export interface ArchiveAudioFile {
  name: string;
  title: string;
  url: string;
}

// Real Internet Archive metadata API — no auth, CORS-enabled
// (https://archive.org/developers/metadata-schema.html). Throws with a
// user-facing reason on anything unexpected.
async function fetchArchiveMetadata(identifier: string) {
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error(`Internet Archive lookup failed (${res.status}).`);
  const data = await res.json();
  const files: Array<{ name: string; format?: string; title?: string }> = data.files || [];
  if (files.length === 0) throw new Error(`No item found for "${identifier}".`);
  const creatorRaw = data.metadata?.creator;
  const info: ArchiveItemInfo = {
    title: data.metadata?.title || identifier,
    creator: Array.isArray(creatorRaw) ? creatorRaw.join(', ') : creatorRaw || '',
  };
  return { info, files };
}

export async function fetchArchiveItemInfo(identifier: string): Promise<ArchiveItemInfo> {
  return (await fetchArchiveMetadata(identifier)).info;
}

// Archive's own format labels for playable audio files (from a real
// /metadata/<id> response's files[].format) — text, images, checksums and
// thumbnails are skipped.
const AUDIO_FORMATS = new Set(['vbr mp3', 'mp3', '128kbps mp3', '64kbps mp3', 'ogg vorbis', 'flac', '24bit flac', 'wave', 'aiff']);
const MP3_FORMATS = new Set(['vbr mp3', 'mp3', '128kbps mp3', '64kbps mp3']);
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|aiff|m4a)$/i;

// The item's playable audio files. Archive items usually carry the same
// track in several formats (original FLAC, derived MP3, Ogg), so when MP3s
// exist only those are returned — one entry per track instead of three.
export async function fetchArchiveAudioFiles(identifier: string): Promise<{ info: ArchiveItemInfo; files: ArchiveAudioFile[] }> {
  const { info, files } = await fetchArchiveMetadata(identifier);
  const audio = files.filter((f) => (f.format && AUDIO_FORMATS.has(f.format.toLowerCase())) || AUDIO_EXTENSIONS.test(f.name));
  if (audio.length === 0) throw new Error(`"${info.title}" has no playable audio files.`);
  const mp3 = audio.filter((f) => f.format && MP3_FORMATS.has(f.format.toLowerCase()));
  const chosen = mp3.length > 0 ? mp3 : audio;
  return {
    info,
    files: chosen.map((f) => ({
      name: f.name,
      title: f.title || f.name.replace(/\.[^/.]+$/, '') || info.title,
      url: `https://archive.org/download/${encodeURIComponent(identifier)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
    })),
  };
}
