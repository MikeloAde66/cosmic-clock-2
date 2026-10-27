import manifest from '../../public/signal-audio/manifest.json';
import { audioFrom } from '@/lib/signal/speech';
import type { AudioManifestEntry } from '@/lib/signal/speech';

/** The recording for a dispatch id (or 'briefing'), if one has been generated. */
export function audioFor(id: string) {
  return audioFrom(manifest as Record<string, AudioManifestEntry>, id);
}
