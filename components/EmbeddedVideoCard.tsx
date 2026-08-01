"use client";

import React from "react";

interface EmbeddedVideoCardProps {
  videoUrl?: string;
}

export default function EmbeddedVideoCard({
  videoUrl = "https://www.youtube-nocookie.com/embed/1CUqs1uAqpQ",
}: EmbeddedVideoCardProps) {
  return (
    <div className="p-3 border rounded-xl border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full overflow-hidden rounded-lg aspect-video">
        <iframe
          className="w-full h-full"
          src={videoUrl}
          title="NASA Live ISS Stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}