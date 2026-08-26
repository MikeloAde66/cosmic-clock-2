// Shared with components/PodsModule.tsx (the Pods Studio track library and
// its localStorage persistence) and components/HomeBroadcastPanel.tsx (a
// read-only "what's in the Pods system" feed on the Home tab). Pulled out
// of PodsModule so both can see the same Track shape/seed data without
// PodsModule needing to export a hook — Home just reads the same
// localStorage key PodsModule already persists to.

export interface ContentSegment {
  // Seconds into playback when this segment becomes the active one.
  time: number;
  text: string;
}

export interface Track {
  id: string;
  title: string;
  frequency: string;
  description: string;
  src: string;
  contentToRead: string;
  playlistId: string;
  isLocal?: boolean;
  embedUrl?: string;
  watchUrl?: string;
  // Optional — when present, the Reading Material pane renders these as
  // individually-scrollable blocks and auto-scrolls/highlights whichever one
  // matches the current playback time instead of showing contentToRead as a
  // single static blob. No current track has this authored yet; it's inert
  // (falls back to contentToRead) until segment data exists for a track.
  contentSegments?: ContentSegment[];
}

// Genuinely empty by default — no seed/demo tracks. The Pods studio starts
// clean; the "Podcaster Studio Setup Guide" card PodsModule shows when
// there's nothing here is a static UI placeholder, not a Track record.
export const INITIAL_TRACKS: Track[] = [];

// Same key + same "clean out invalid blobs from previous browser sessions"
// validation PodsModule's own mount effect already does, so a reader (e.g.
// the Home broadcast panel) sees exactly what Pods would show, without
// needing PodsModule to be mounted/active.
export function loadStoredTracks(): Track[] | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem('aione_tracks_v2');
  if (!saved) return null;
  try {
    const parsed: Track[] = JSON.parse(saved);
    const validTracks = parsed.filter((t) => !t.isLocal || t.src.startsWith('http'));
    return validTracks.length > 0 ? validTracks : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}
