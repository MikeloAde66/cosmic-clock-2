'use client';

import { useEffect, useRef, useState } from 'react';

// Powers Reveal.tsx's scroll-triggered entrance animation — fires once
// (disconnects itself) rather than toggling on every scroll in/out, so
// content doesn't re-fade away when scrolling back up past it.
export function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options is
    // expected to be a stable/static object per call site, not re-created
    // each render; re-running this on every options identity change would
    // pointlessly tear down and re-create the observer.
  }, []);

  return { ref, inView };
}
