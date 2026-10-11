export interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
  loadVideoById: (videoId: string | { videoId: string; startSeconds?: number }) => void;
  loadPlaylist: (playlist: { list: string; listType?: string; index?: number; startSeconds?: number }) => void;
}

export interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayer;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};