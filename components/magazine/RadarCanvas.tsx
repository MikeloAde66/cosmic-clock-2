'use client';

import { useEffect, useRef } from 'react';
import type { RadarTarget } from '@/lib/spreads/types';

interface RadarCanvasProps {
  targets: RadarTarget[];
  selectedTarget: RadarTarget;
  onSelectTarget: (target: RadarTarget) => void;
  compassLabels: { n: string; s: string; e: string; w: string; nw: string; ne: string; center: string };
  className?: string;
}

// Same radar-sweep/rotating-crosshair/pulsing-selected-ring engine as
// protolabsglobal-main-shell's index.star.html (drawSkyMap), just re-homed
// as a standalone component so any future spread (geology dig sites,
// climate stations, historical sites) can plot its own target set through
// the same visual without touching this file — only `targets` changes.
export default function RadarCanvas({ targets, selectedTarget, onSelectTarget, compassLabels, className }: RadarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Refs (not state) for anything read inside the rAF loop or click
  // handler — avoids re-subscribing the loop/listener on every render and
  // keeps the animation's own timing free of React's render cycle.
  const targetsRef = useRef(targets);
  const selectedRef = useRef(selectedTarget);
  const onSelectRef = useRef(onSelectTarget);
  const rafRef = useRef<number | undefined>(undefined);

  // Kept in sync via effect (not a direct in-render assignment) so the
  // rAF loop and click handler below always see the latest props without
  // themselves being effect dependencies that would tear the loop down
  // and rebuild it every render.
  useEffect(() => {
    targetsRef.current = targets;
    selectedRef.current = selectedTarget;
    onSelectRef.current = onSelectTarget;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    function resize() {
      if (!canvas!.parentElement) return;
      canvas!.width = canvas!.parentElement.clientWidth;
      canvas!.height = canvas!.parentElement.clientHeight;
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement!);

    function draw(timestamp: number) {
      const w = canvas!.width;
      const h = canvas!.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.42;

      ctx!.clearRect(0, 0, w, h);

      ctx!.fillStyle = '#030814';
      ctx!.beginPath();
      ctx!.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx!.lineWidth = 1;
      [0.3, 0.65, 1.0].forEach((rRatio) => {
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius * rRatio, 0, Math.PI * 2);
        ctx!.stroke();
      });

      ctx!.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx!.beginPath();
      ctx!.moveTo(cx - radius, cy);
      ctx!.lineTo(cx + radius, cy);
      ctx!.moveTo(cx, cy - radius);
      ctx!.lineTo(cx, cy + radius);
      ctx!.stroke();

      // RADAR SWEEP — bright leading edge + a 26-step fading trail, drawn
      // as discrete lines (not a canvas conic gradient) for identical
      // rendering across every browser.
      const sweepAngle = (timestamp / 2600) % (Math.PI * 2);
      const TRAIL_STEPS = 26;
      const TRAIL_SPAN = Math.PI / 2.2;
      for (let i = TRAIL_STEPS; i >= 1; i--) {
        const a = sweepAngle - (i / TRAIL_STEPS) * TRAIL_SPAN;
        const alpha = (1 - i / TRAIL_STEPS) * 0.35;
        ctx!.strokeStyle = `rgba(0, 240, 255, ${alpha.toFixed(3)})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        ctx!.stroke();
      }
      ctx!.save();
      ctx!.strokeStyle = '#00f0ff';
      ctx!.lineWidth = 1.5;
      ctx!.shadowColor = '#00f0ff';
      ctx!.shadowBlur = 12;
      ctx!.beginPath();
      ctx!.moveTo(cx, cy);
      ctx!.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
      ctx!.stroke();
      ctx!.restore();

      ctx!.fillStyle = '#00f0ff';
      ctx!.font = 'bold 12px "JetBrains Mono", monospace';
      ctx!.fillText(compassLabels.n, cx - 4, cy - radius + 18);
      ctx!.fillText(compassLabels.s, cx - 4, cy + radius - 8);
      ctx!.fillText(compassLabels.e, cx + radius - 18, cy + 4);
      ctx!.fillText(compassLabels.w, cx - radius + 8, cy + 4);
      ctx!.fillText(compassLabels.nw, cx - radius * 0.6, cy - radius * 0.6);
      ctx!.fillText(compassLabels.ne, cx + radius * 0.52, cy - radius * 0.6);
      ctx!.fillText(compassLabels.center, cx - 20, cy + 24);

      // Each target's crosshair rotates slowly and continuously (full turn
      // every ~24s), with a per-target phase offset so they don't spin in
      // lockstep.
      targetsRef.current.forEach((t, i) => {
        const tx = cx + t.x * radius * 1.5;
        const ty = cy + t.y * radius * 1.5;
        const rot = (timestamp / 24000) * Math.PI * 2 + i * 0.6;

        ctx!.save();
        ctx!.translate(tx, ty);
        ctx!.rotate(rot);
        ctx!.strokeStyle = t.color;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(0, -5);
        ctx!.lineTo(5, 0);
        ctx!.lineTo(0, 5);
        ctx!.lineTo(-5, 0);
        ctx!.closePath();
        ctx!.stroke();
        ctx!.restore();

        ctx!.fillStyle = '#ffffff';
        ctx!.font = '10px "JetBrains Mono", monospace';
        ctx!.fillText(t.name, tx + 8, ty + 3);
      });

      const sel = selectedRef.current;
      const stx = cx + sel.x * radius * 1.5;
      const sty = cy + sel.y * radius * 1.5;

      // Pulses gently so it reads as "locked", distinct from the plain
      // rotating crosshairs above.
      const pulse = 12 + Math.sin(timestamp / 400) * 2;
      ctx!.strokeStyle = '#00f0ff';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(stx, sty, pulse, 0, Math.PI * 2);
      ctx!.stroke();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    function handleClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = canvas!.width / 2;
      const cy = canvas!.height / 2;
      const radius = Math.min(canvas!.width, canvas!.height) * 0.42;

      for (const t of targetsRef.current) {
        const tx = cx + t.x * radius * 1.5;
        const ty = cy + t.y * radius * 1.5;
        if (Math.hypot(mx - tx, my - ty) < 22) {
          onSelectRef.current(t);
          break;
        }
      }
    }
    canvas.addEventListener('click', handleClick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
    };
    // compassLabels is static config, not per-render state — omitted from
    // deps deliberately so the loop/listener aren't torn down and rebuilt
    // every frame; targets/selectedTarget/onSelectTarget flow through the
    // refs above instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
