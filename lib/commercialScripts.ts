import type { CommercialCaption } from '@/components/CommercialPlayer';

// Exactly the copy supplied for each spot — likely a fragment of the full
// script, not the complete final read. Timings are evenly-spaced
// placeholders (see CommercialPlayer) since no real audio exists to time
// against yet; only the text is real. Recalibrate start/end once a real
// track is recorded/generated.
export const COMMERCIAL_CAPTIONS: Record<string, CommercialCaption[]> = {
  'hydronode-pro': [
    { start: 0, end: 3.5, text: 'In a world full of mystery water, one system dares to ask:' },
    { start: 3.5, end: 6.5, text: 'What is actually in this cup?' },
    { start: 6.5, end: 9.5, text: 'Enter HydroNode Pro...' },
  ],
};
