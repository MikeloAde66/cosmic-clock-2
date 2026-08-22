'use client';

import { useEffect, useRef } from 'react';

interface PlayerSpectrumProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isPlaying: boolean;
  // Defaults match the original compact player-bar sizing exactly — both
  // optional so the existing GlobalPlayerBar usage is unaffected.
  width?: number;
  height?: number;
}

// Compact bar-graph visualizer for the player bar — reads live frequency
// data from the AnalyserNode RadioPlayerContext wires up on first playback
// (see ensureAnalyser there). Renders a flat/empty canvas whenever there's
// no analyser yet or nothing playing, rather than an error — this is a
// decorative element, not one that should ever block the player bar.
export default function PlayerSpectrum({ analyserRef, isPlaying, width = 72, height = 20 }: PlayerSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const analyser = analyserRef.current;
      if (!analyser || !isPlaying) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        // Accent color matching the cyan/neon theme used elsewhere (globe markers, HUD).
        ctx.fillStyle = `rgba(0, 240, 255, ${dataArray[i] / 255 + 0.2})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [analyserRef, isPlaying]);

  return <canvas ref={canvasRef} width={width} height={height} className="opacity-70 pointer-events-none shrink-0" />;
}
