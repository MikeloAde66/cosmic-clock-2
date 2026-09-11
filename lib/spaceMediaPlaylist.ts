// Per-browser playlist of user-saved video links for the Star Tracker's
// Space Media tab — localStorage only, no backend, no hardcoded videos.
// Accepts any real YouTube URL the user pastes (watch/youtu.be/embed/live/
// shorts links), extracts the real video id, and stores just id+title.

export interface PlaylistItem {
  id: string;
  title: string;
  videoId: string;
  addedAt: number;
}

const STORAGE_KEY = 'cosmic_space_media_playlist_v1';
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  // list=/si=/index=/t=/start_radio= etc. were never the actual problem —
  // parsed.searchParams.get('v') and the pathname-based branches below
  // already ignore any other query params by construction (confirmed
  // directly: a /watch?v=...&list=...&si=... link already extracts just
  // the v value). The real gap was the mobile share hostname
  // (m.youtube.com), stripped here alongside www. — youtu.be short links
  // (also common from mobile "Share") already worked, since ?si= there is
  // a query param too and never touched the pathname this reads from.
  let id: string | null = null;
  const hostname = parsed.hostname.replace(/^(www\.|m\.)/, '');
  if (parsed.hostname === 'youtu.be') {
    id = parsed.pathname.slice(1).split('/')[0] || null;
  } else if (hostname === 'youtube.com') {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
    else if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.split('/')[2] || null;
    else if (parsed.pathname.startsWith('/live/')) id = parsed.pathname.split('/')[2] || null;
    else if (parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.split('/')[2] || null;
  }

  return id && VIDEO_ID_RE.test(id) ? id : null;
}

export function listPlaylist(): PlaylistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: PlaylistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to persist Space Media playlist:', err);
  }
}

export function savePlaylistItem(title: string, videoId: string): PlaylistItem[] {
  const item: PlaylistItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: title.trim() || 'Untitled clip',
    videoId,
    addedAt: Date.now(),
  };
  const updated = [item, ...listPlaylist()];
  writeAll(updated);
  return updated;
}

export function removePlaylistItem(id: string): PlaylistItem[] {
  const updated = listPlaylist().filter((i) => i.id !== id);
  writeAll(updated);
  return updated;
}
