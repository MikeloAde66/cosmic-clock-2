'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import type { Dispatch } from '@/lib/signal/dispatches';
import styles from './signal.module.css';

// Share one explainer: the phone's own share sheet where there is one, and
// otherwise copy the link. The link is this page's address plus the dispatch id,
// so it opens straight to the explainer on whichever domain it was shared from.
export default function ShareButton({ d }: { d: Dispatch }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = (next: 'copied' | 'failed') => {
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${d.id}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: d.headline, text: d.dek, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('copied');
    } catch {
      flash('failed');
    }
  };

  return (
    <button type="button" className={styles.listenBtn} onClick={share} aria-label={`Share ${d.headline}`}>
      {state === 'copied' ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
      {state === 'copied' ? 'LINK COPIED' : state === 'failed' ? 'COPY THE ADDRESS BAR' : 'SHARE'}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {state === 'copied' ? 'Link copied' : ''}
      </span>
    </button>
  );
}
