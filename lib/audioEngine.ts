// lib/audioEngine.ts

export type AudioSourceType = "pod" | "video" | "ai_bot";

export interface AudioTrack {
  id: string | number;
  title: string;
  src: string;
  type: AudioSourceType;
}

class UniversalAudioEngine {
  private activeElement: HTMLAudioElement | HTMLVideoElement | null = null;
  private currentTrackId: string | number | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.9;

  /**
   * Connect and stream any audio URL (Podcasts, AI Bot Voice Streams, Hosted Files)
   */
  public async playStream(id: string | number, streamUrl: string): Promise<boolean> {
    // If clicking the same track while playing, toggle pause
    if (this.currentTrackId === id && this.activeElement) {
      if (!this.activeElement.paused) {
        this.pause();
        return false;
      } else {
        try {
          await this.activeElement.play();
          return true;
        } catch (err) {
          console.warn("[AudioEngine] Resume prevented:", err);
          this.stop();
          return false;
        }
      }
    }

    // Stop existing playback before initializing new track
    this.stop();

    if (!streamUrl || streamUrl.trim() === "") {
      console.warn(`[AudioEngine] No valid audio URL assigned for track ID: ${id}`);
      return false;
    }

    try {
      const audio = new Audio(streamUrl);
      audio.volume = this.volume;
      audio.muted = this.isMuted;
      
      this.activeElement = audio;
      this.currentTrackId = id;

      this.activeElement.onended = () => {
        this.stop();
      };

      // Safely await play promise to catch unhandled rejection errors
      await this.activeElement.play();
      return true;
    } catch (err) {
      console.warn(`[AudioEngine] Playback failed for track [${id}]. Source URL may be invalid or unreachable:`, err);
      this.stop();
      return false;
    }
  }

  /**
   * Connect native DOM Video or Audio elements directly
   */
  public async playElement(
    id: string | number,
    element: HTMLAudioElement | HTMLVideoElement
  ): Promise<boolean> {
    this.stop();
    
    this.activeElement = element;
    this.currentTrackId = id;
    this.activeElement.volume = this.volume;
    this.activeElement.muted = this.isMuted;

    try {
      await this.activeElement.play();
      return true;
    } catch (err) {
      console.warn(`[AudioEngine] DOM Element play error for [${id}]:`, err);
      this.stop();
      return false;
    }
  }

  public pause() {
    if (this.activeElement && !this.activeElement.paused) {
      this.activeElement.pause();
    }
  }

  public stop() {
    if (this.activeElement) {
      this.activeElement.pause();
      if ("currentTime" in this.activeElement) {
        try {
          this.activeElement.currentTime = 0;
        } catch {
          // Ignore state errors if media hasn't loaded metadata
        }
      }
      this.activeElement = null;
    }
    this.currentTrackId = null;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.activeElement) {
      this.activeElement.volume = this.volume;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.activeElement) {
      this.activeElement.muted = this.isMuted;
    }
    return this.isMuted;
  }

  public getCurrentTrackId(): string | number | null {
    return this.currentTrackId;
  }

  public isPlaying(): boolean {
    return !!(this.activeElement && !this.activeElement.paused);
  }
}

export const audioEngine = new UniversalAudioEngine();