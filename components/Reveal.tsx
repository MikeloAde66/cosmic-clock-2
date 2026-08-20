'use client';

import React from 'react';
import { useInView } from '@/lib/useInView';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

// Fade + slide-up entrance animation as content scrolls into view — plain
// CSS transitions driven by IntersectionObserver (see lib/useInView.ts),
// not Framer Motion, consistent with this app's existing CSS-only
// convention for scroll/visual effects rather than adding a new animation
// dependency for something Tailwind transitions already cover.
export default function Reveal({ children, className = '', delayMs = 0 }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
