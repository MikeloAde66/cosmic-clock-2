// Shared global type declarations for the real YouTube IFrame Player API —
// used by both PodsModule.tsx and StarTrackerView.tsx (Sky Fest's Space
// Media tab). Kept in one place because `declare global` blocks for the
// same Window member (YT) merge across files in the same TS program;
// declaring two different shapes in two files would conflict.
export interface YouTubePlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string) => void;
  loadPlaylist: (options: { list: string }) => void;
  pauseVideo: () => void;
  // 0-100 integer — the real IFrame API method, distinct from (and
  // unreachable by) Web Audio gain nodes, which can't touch a cross-origin
  // YouTube iframe's audio at all.
  setVolume: (volume: number) => void;
  destroy: () => void;
}

export interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayer;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        // A real HTMLElement, not just an id string — YT.Player replaces
        // whatever element it's given with its own <iframe>, outside
        // React's reconciliation, so callers mount it into an
        // imperatively-created div rather than a JSX-owned node.
        elementId: string | HTMLElement,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: YouTubePlayerEvent) => void;
            onStateChange?: (event: YouTubePlayerEvent) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
