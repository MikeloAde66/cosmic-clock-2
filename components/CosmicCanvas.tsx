"use client";

import React, { useEffect, useRef } from "react";

export default function CosmicCanvas({ kpIndex = 2.1 }: { kpIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Create 200 bright, twinkling cosmic stars
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.5 + 1.0, // Larger star sizes
      alpha: Math.random(),
      speed: 0.01 + Math.random() * 0.02,
      // Mixture of gold, cyan, and bright white star colors
      color: Math.random() > 0.4 ? "251, 191, 36" : Math.random() > 0.5 ? "56, 189, 248" : "255, 255, 255",
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      stars.forEach((star) => {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0.2) star.speed = -star.speed;

        // Bright outer glow for stars
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${Math.abs(star.alpha) * 0.3})`;
        ctx.fill();

        // Core bright center
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${Math.abs(star.alpha)})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [kpIndex]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}