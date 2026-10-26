import { Big_Shoulders, IBM_Plex_Mono, Literata } from 'next/font/google';

// The three faces of the Signal magazine: a tall condensed display face, a
// readable serif for body copy, and a mono for labels. Big Shoulders Display
// is now the large optical sizes of the single Big Shoulders family.
export const signalDisplay = Big_Shoulders({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['opsz'],
  variable: '--font-signal-display',
  display: 'swap',
});

export const signalBody = Literata({
  subsets: ['latin'],
  variable: '--font-signal-body',
  display: 'swap',
});

export const signalMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-signal-mono',
  display: 'swap',
});
