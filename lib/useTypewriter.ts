'use client';

import { useEffect, useState } from 'react';

// Same teletype approach already used for NoaaWidget's forecast readout —
// recompute the full slice each tick (rather than appending onto previous
// state) so this self-corrects if the effect ever fires more than once.
export function useTypewriter(text: string, active: boolean, speedMs = 35) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    if (!active) return;
    setOutput('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setOutput(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speedMs);
    return () => clearInterval(interval);
  }, [text, active, speedMs]);

  return output;
}
