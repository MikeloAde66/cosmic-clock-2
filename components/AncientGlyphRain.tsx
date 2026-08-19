'use client';

import { useEffect, useRef } from 'react';

// Matrix-style rain of Brahmi/Sanskrit numeral glyphs, decorative background
// layer for the Kali Yuga panel — pointer-events-none, sits behind the real
// content (see z-index usage at the call site).
const GLYPHS = '०१२३४५६७८९0123456789∑∫∆∇∝∞';
const FONT_SIZE = 13;
// A single setInterval tick IS the frame — deliberately not layered with
// requestAnimationFrame (calling rAF from inside a setInterval callback
// spawns a second, unthrottled ~60fps loop on top of the interval one,
// defeating the whole point of throttling this down). Slow and hypnotic,
// not a fast flicker — both the fall speed and the glyph-swap rate are
// tied to this one interval, so this single number controls the pace.
const FRAME_INTERVAL_MS = 140;

export default function AncientGlyphRain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 600;
    canvas.height = canvas.parentElement?.clientHeight || 500;

    const columns = Math.floor(canvas.width / FONT_SIZE);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      // A translucent fill instead of a hard clear is what actually makes
      // this read as "rain": each frame dims the previous one instead of
      // erasing it outright, leaving the classic fading trail behind each
      // falling glyph. A hard clearRect here would just flicker one
      // character per column in and out with no sense of motion.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.font = `${FONT_SIZE}px "Courier New", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillText(text, i * FONT_SIZE, drops[i] * FONT_SIZE);

        if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.96) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 w-full h-full opacity-45 pointer-events-none"
    />
  );
}
