'use client';

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      maps: {
        importLibrary: (name: string) => Promise<{
          Map3DElement: new (options: {
            center: { lat: number; lng: number; altitude: number };
            range: number;
            heading: number;
            tilt: number;
            mapId: string;
          }) => HTMLElement;
        }>;
      };
    };
  }
}

export default function DroneSimulator() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [telemetry] = useState({
    alt: 80,
    heading: 45,
    speed: 12,
  });

  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initialize Google 3D Map
    async function initGoogleMap() {
      try {
        const apiKey = "AIzaSyBA-jsBzdH2C5JVZV0MQTvX2zItBhvp7A";
        
        if (!document.getElementById("google-maps-script")) {
          const script = document.createElement('script');
          script.id = "google-maps-script";
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta&libraries=maps3d`;
          script.async = true;
          script.onload = () => renderMap3D();
          document.head.appendChild(script);
        } else {
          renderMap3D();
        }
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error initializing Google 3D Map');
        setLoading(false);
      }
    }

    async function renderMap3D() {
      try {
        const { Map3DElement } = await window.google!.maps.importLibrary("maps3d");
        
const map3D = new Map3DElement({
  center: { lat: 32.7765, lng: -79.9311, altitude: 80 },
  range: 500, // Replaces zoom: 18
  heading: 45,
  tilt: 67.5,
  mapId: "90f87085c36e379",
});        if (mapRef.current) {
          mapRef.current.innerHTML = "";
          mapRef.current.appendChild(map3D);
        }
        
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }

    initGoogleMap();

    // 2. Setup Three.js + Cannon.js Physics Simulator on top
    const container = document.createElement('div');
    container.id = 'sim-container';
    container.style.cssText = 'width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; z-index: 5; pointer-events: none;';
    document.body.appendChild(container);

    // Dynamically load Three and Cannon scripts if not present
    if (!Reflect.get(window, 'THREE')) {
      const threeScript = document.createElement('script');
      threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      document.head.appendChild(threeScript);
    }
    if (!Reflect.get(window, 'CANNON')) {
      const cannonScript = document.createElement('script');
      cannonScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';
      document.head.appendChild(cannonScript);
    }

    return () => {
      const existingContainer = document.getElementById('sim-container');
      if (existingContainer) existingContainer.remove();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden font-mono select-none bg-slate-950 text-cyan-300">
      {/* Google 3D Map Viewport Container */}
      <div ref={mapRef} className="absolute inset-0 z-0 w-full h-full pointer-events-auto" />

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 text-cyan-400">
          Loading 3D Spatial Environment...
        </div>
      )}

      {error && (
        <div className="absolute z-30 p-3 text-xs text-red-300 border border-red-500 rounded bottom-4 left-4 bg-red-950/80">
          {error}
        </div>
      )}

      {/* HUD Telemetry Overlay */}
      <div className="absolute z-10 p-4 text-xs border shadow-2xl top-4 left-4 bg-slate-900/80 backdrop-blur-md border-cyan-500/30 rounded-xl">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/30">
          <span className="font-bold text-cyan-400">AiOne VIRTUAL DRONE HUD</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
            GOOGLE 3D
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 text-slate-300">
          <div>Altitude: <span className="font-bold text-white">{telemetry.alt} m</span></div>
          <div>Heading: <span className="font-bold text-white">{telemetry.heading}°</span></div>
          <div>Speed: <span className="font-bold text-white">{telemetry.speed} m/s</span></div>
          <div>Camera: <span className="font-bold text-amber-400">Chase-Cam</span></div>
          <div className="col-span-2">Environment: <span className="font-bold text-cyan-300">Charleston, SC</span></div>
          <div className="col-span-2">Model: <span className="font-bold text-cyan-300">Rescue Quad-v2</span></div>
        </div>
        <div className="mt-3 pt-2 border-t border-cyan-500/20 text-[10px] text-slate-400">
          <span className="font-bold text-cyan-400">WASD</span> Fly | <span className="font-bold text-cyan-400">Space/Shift</span> Climb
        </div>
      </div>
    </div>
  );
}