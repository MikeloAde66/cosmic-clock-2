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

export const INITIAL_TRACKS: Track[] = [
  {
    id: '1',
    title: 'The Art & Science of Forest Bathing',
    frequency: 'Video / Science',
    description: 'Dr Qing Li on the biology of phytoncides and shinrin-yoku forest medicine. (Penguin Books UK)',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/12CCjoixpkA',
    watchUrl: 'https://www.youtube.com/watch?v=12CCjoixpkA',
    playlistId: 'pods',
    contentToRead: `### Forest Bathing & Human Immunity\n\nDr Qing Li, the world's foremost expert in forest medicine, explains how trees emit airborne organic compounds (phytoncides) that lower stress hormones and enhance human immune function.`
  },
  {
    id: '2',
    title: 'Aeon Byte: A Gnostic View of the Soul',
    frequency: 'Video / Dialogue',
    description: 'Aeon Byte Gnostic Radio on the Hymn of the Pearl and the Exegesis from the Nag Hammadi library.',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/CY2P9q7bEVY',
    watchUrl: 'https://www.youtube.com/watch?v=CY2P9q7bEVY',
    playlistId: 'pods',
    contentToRead: `### Historical & Cosmological Discourse\n\nAeon Byte Gnostic Radio examines two key Nag Hammadi scriptures on the fall and redemption of the soul: the Hymn of the Pearl and the Exegesis.`
  },
  {
    id: '3',
    title: 'Anil Seth: The Mystery of Consciousness',
    frequency: 'Video / Lecture',
    description: 'The TED Interview with neuroscientist Anil Seth on perception, prediction, and machine consciousness.',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/aQVedpfKt88',
    watchUrl: 'https://www.youtube.com/watch?v=aQVedpfKt88',
    playlistId: 'pods',
    contentToRead: `### Cognitive Perception & Self-Awareness\n\nNeuroscientist Anil Seth explores his theory that consciousness is a controlled hallucination — the brain constantly predicting and constructing our perceived reality.`
  },
  {
    id: '4',
    title: 'The Precession of Equinox',
    frequency: 'Video / Ambient',
    description: 'A short visual on the slow astronomical cycle behind the Great Year. (The Randall Carlson)',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/jnIBFXVWZXg',
    watchUrl: 'https://www.youtube.com/watch?v=jnIBFXVWZXg',
    playlistId: 'pods',
    contentToRead: `### The Great Year & Astronomical Alignment\n\nAncient timekeeping systems tracked vast epochs through the slow movement of the equinoxes across the zodiac constellations.`
  }
];

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
