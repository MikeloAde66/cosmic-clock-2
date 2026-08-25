import type { CommercialCaption } from '@/components/CommercialPlayer';

// Exactly the copy supplied for each spot — likely a fragment of the full
// script, not the complete final read. Timings are evenly-spaced
// placeholders (see CommercialPlayer) since no real audio exists to time
// against yet; only the text is real. Recalibrate start/end once a real
// track is recorded/generated.
export const COMMERCIAL_CAPTIONS: Record<string, CommercialCaption[]> = {
  'builder-kit': [
    { start: 0, end: 4, text: 'Is your off-grid water supply looking less like fresh spring water and more like swamp soup?' },
    { start: 4, end: 7, text: "Don't panic..." },
  ],
  'hydronode-pro': [
    { start: 0, end: 3.5, text: 'In a world full of mystery water, one system dares to ask:' },
    { start: 3.5, end: 6.5, text: 'What is actually in this cup?' },
    { start: 6.5, end: 9.5, text: 'Enter HydroNode Pro...' },
  ],
  'aione-core': [
    { start: 0, end: 3, text: "Your code crashed again, didn't it?" },
    { start: 3, end: 7, text: "And now you're staring at the monitor, waiting for a miracle." },
    { start: 7, end: 10, text: 'Say hello to Ai One Core...' },
  ],
};
