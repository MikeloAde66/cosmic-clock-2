'use client';

import { useEffect, useId, useRef } from 'react';

export type LedState = 'off' | 'standby' | 'active' | 'fault';

// Indicator light with the behaviours from the cockpit spec:
//   off      static and dim
//   standby  slow breathing, each LED on its own cycle so they never sync
//   active   steady, with a brief dip every few seconds (sometimes a double
//            flicker) on its own random timer, so it reads as real hardware
//   fault    hard on/off blink, not a fade
// Reduced-motion users get the static brightness only.
export default function Led({ color, state, size = 6 }: { color: string; state: LedState; size?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  // Per-LED timing from the element's own id, so lights never share a rhythm.
  const id = useId();
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  const c = { breathe: 2.5 + (h % 100) / 66, fault: 0.8 + ((h * 7) % 100) / 166 };

  useEffect(() => {
    const node = el.current;
    if (!node || state !== 'active') return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers = new Set<number>();
    let alive = true;
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
    };
    const dip = (remaining: number) => {
      node.style.opacity = String(0.4 + Math.random() * 0.2);
      later(() => {
        node.style.opacity = '1';
        if (remaining > 1) later(() => dip(remaining - 1), 70 + Math.random() * 60);
      }, 60 + Math.random() * 90);
    };
    const next = () =>
      later(() => {
        dip(Math.random() < 1 / 6 ? 2 : 1);
        next();
      }, 3000 + Math.random() * 5000);
    next();
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [state]);

  const base: React.CSSProperties = { width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flex: 'none' };
  if (state === 'off') return <span aria-hidden="true" style={{ ...base, opacity: 0.3 }} />;
  if (state === 'standby')
    return (
      <span
        aria-hidden="true"
        className="cn-breathe"
        style={{ ...base, boxShadow: `0 0 4px ${color}`, ['--d' as string]: `${c.breathe.toFixed(2)}s`, ['--lo' as string]: 0.5, ['--hi' as string]: 0.7 } as React.CSSProperties}
      />
    );
  if (state === 'fault')
    return <span aria-hidden="true" className="cn-fault" style={{ ...base, boxShadow: `0 0 6px ${color}`, ['--d' as string]: `${c.fault.toFixed(2)}s` } as React.CSSProperties} />;
  return <span ref={el} aria-hidden="true" style={{ ...base, boxShadow: `0 0 6px ${color}`, opacity: 1 }} />;
}
