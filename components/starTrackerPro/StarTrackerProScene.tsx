'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RefreshCw } from 'lucide-react';
import { isWebGLAvailable } from '@/lib/starTrackerPro/webgl';
import { buildStarInstanceBuffers, loadRawStarCatalog, type IdentifiedStar, type RawStarEntry, type StarInstanceBuffers } from '@/lib/starTrackerPro/starCatalogBuffers';
import {
  buildConstellationLineBuffer,
  type ConstellationLineBuffer,
  type ConstellationLineSegment,
} from '@/lib/starTrackerPro/constellationLines';
import type { GeodeticLocation } from '@/lib/starTrackerPro/coordinates';
import CelestialSphere, { DOME_RADIUS, type HoveredStarInfo } from './CelestialSphere';
import ConstellationLines from './ConstellationLines';
import AltAzGrid from './AltAzGrid';
import CanvasErrorBoundary from './CanvasErrorBoundary';

// Auto-retry delay after a lost/failed WebGL context before remounting the
// whole <Canvas> (a fresh mount is the only way to get a fresh
// THREE.WebGLRenderer — there's no supported "just recreate the context on
// the existing renderer" API). Long enough that a GPU process crash-loop
// doesn't spin us into one too; short enough the visitor isn't staring at
// the fallback for a full lost tab-switch cycle.
const CONTEXT_RETRY_DELAY_MS = 3000;

// Real position tick — sidereal drift is continuous but slow (~15°/hour);
// recomputing once a second is genuinely fine visually while keeping the
// Alt/Az math (and the instance-matrix rebuild it triggers) off the
// per-frame render path. See CelestialSphere's own comment for why that
// separation matters for real 60fps rendering.
const POSITION_TICK_MS = 1000;

// Lives inside <Canvas> (the only place `useThree`'s gl/renderer is
// available) purely to attach/detach the real DOM 'webglcontextlost' /
// 'webglcontextrestored' listeners on gl.domElement with a proper
// useEffect cleanup — renders nothing itself.
function CanvasContextWatcher({ onLost, onRestored }: { onLost: (e: Event) => void; onRestored: () => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, onLost, onRestored]);

  return null;
}

function CanvasFallbackNotice({ reason, onRetry }: { reason: 'unsupported' | 'lost'; onRetry?: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#010314]">
      <div className="max-w-sm px-6 py-5 mx-4 text-center border rounded-lg border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <p className="font-mono text-sm text-slate-200">
          {reason === 'unsupported' ? 'WebGL is unavailable in this browser.' : 'The 3D view lost its graphics context.'}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-400">
          {reason === 'unsupported'
            ? 'Star Tracker PRO needs WebGL to render the sky. Try a different browser or enable hardware acceleration.'
            : 'This can happen after the GPU is reclaimed by the system (e.g. after the tab was backgrounded).'}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-4 text-[11px] font-mono uppercase tracking-wide rounded border border-slate-600 text-white/80 hover:border-slate-400 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" />
            Retry now
          </button>
        )}
      </div>
    </div>
  );
}

// react-three-fiber's own <Canvas> internally does `clock: new THREE.Clock()`
// on every mount (confirmed against the exact compiled chunk this app
// serves — @react-three/fiber's store creation, unchanged as of the latest
// stable 9.7.0) to back useFrame's `state.clock`/delta. THREE.Clock itself
// was deprecated in three r183 in favor of THREE.Timer, so its constructor
// unconditionally logs a console.warn — not from any Clock usage of our
// own (this app's own code never instantiates THREE.Clock; see
// starCatalogBuffers.ts/constellationLines.ts for this app's real position
// timing, which is plain Date-based, not a Three.js clock at all). There is
// no supported R3F prop to swap in a Timer instead — `clock` on the store
// is typed as THREE.Clock in R3F's own public API. Filtering only this one
// message (chaining to whatever console function, if any, was already
// installed) is a narrow, reversible workaround for the upstream noise; the
// real fix is dropping this once R3F ships a stable release that replaces
// its internal Clock with Timer (already true on their unreleased 10.0.0
// canaries, not yet in a stable version).
if (typeof window !== 'undefined') {
  const previousConsoleFn = THREE.getConsoleFunction();
  THREE.setConsoleFunction((level, message, ...params) => {
    if (typeof message === 'string' && message.includes('Clock: This module has been deprecated')) return;
    if (previousConsoleFn) {
      previousConsoleFn(level, message, ...params);
      return;
    }
    (level === 'warn' ? console.warn : level === 'error' ? console.error : console.log)(message, ...params);
  });
}

export interface StarTrackerProSceneProps {
  location: GeodeticLocation;
  now: Date;
  // Owned by the caller (StarTrackerProCanvas loads it once and also feeds
  // ObjectTooltip's constellation-name lookup with it), passed down here
  // purely to build the line geometry — this component never fetches it
  // itself.
  constellationSegments: ConstellationLineSegment[] | null;
  showConstellations?: boolean;
  showGrid?: boolean;
  onHoverStar?: (info: HoveredStarInfo | null) => void;
  onSelectStar?: (star: IdentifiedStar) => void;
}

// The bare WebGL celestial sphere — stars, constellation lines, Alt/Az
// grid, camera controls, and the fallback/context-loss handling around all
// of it. No chrome of its own (no Back button, toolbar, geo label, or
// Device Hub) so it can be mounted either inside StarTrackerProCanvas
// (which adds that chrome for the in-app modal use in app/page.tsx) or as
// a bare full-screen background behind a different HUD entirely (see
// StarTrackerProBackground, used by the standalone /star-tracker route).
export default function StarTrackerProScene({
  location,
  now,
  constellationSegments,
  showConstellations = true,
  showGrid = false,
  onHoverStar,
  onSelectStar,
}: StarTrackerProSceneProps) {
  const [catalog, setCatalog] = useState<RawStarEntry[] | null>(null);
  const [buffers, setBuffers] = useState<StarInstanceBuffers | null>(null);
  const [constellationBuffer, setConstellationBuffer] = useState<ConstellationLineBuffer | null>(null);

  // Checked once, lazily, so the (synchronous, cheap) probe never runs
  // during SSR/hydration — only matters once we're actually about to mount
  // a real <Canvas> in the browser.
  const [webglSupported] = useState(isWebGLAvailable);
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remountCanvas = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setContextLost(false);
    setCanvasKey((k) => k + 1);
  }, []);

  const handleContextLost = useCallback((event: Event) => {
    // Without preventDefault(), the browser treats the loss as permanent
    // and never fires 'webglcontextrestored' — remounting with a fresh
    // renderer (via canvasKey) is what actually recovers, but this keeps
    // the door open in case the same context comes back on its own first.
    event.preventDefault();
    console.warn('Star Tracker PRO: WebGL context lost.');
    setContextLost(true);
    retryTimeoutRef.current = setTimeout(remountCanvas, CONTEXT_RETRY_DELAY_MS);
  }, [remountCanvas]);

  const handleContextRestored = useCallback(() => {
    console.info('Star Tracker PRO: WebGL context restored.');
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setContextLost(false);
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRawStarCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err) => console.error('Star catalog load failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    setBuffers(buildStarInstanceBuffers(catalog, location, now, DOME_RADIUS));
    // location is a fresh object every render (GeoCoords isn't memoized
    // upstream) — real lat/lon values are what matter for recomputation,
    // not the wrapper object's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, now, location.latitudeDeg, location.longitudeDeg]);

  useEffect(() => {
    if (!constellationSegments || !showConstellations) return;
    setConstellationBuffer(buildConstellationLineBuffer(constellationSegments, location, now, DOME_RADIUS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constellationSegments, showConstellations, now, location.latitudeDeg, location.longitudeDeg]);

  if (!webglSupported) return <CanvasFallbackNotice reason="unsupported" />;

  return (
    <>
      <CanvasErrorBoundary key={canvasKey} fallback={<CanvasFallbackNotice reason="lost" onRetry={remountCanvas} />}>
        <Canvas
          camera={{ position: [0, 0, 0.1], fov: 75, near: 0.1, far: DOME_RADIUS * 2 }}
          gl={{ powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        >
          <CanvasContextWatcher onLost={handleContextLost} onRestored={handleContextRestored} />
          {/* Near-black with a faint navy cast rather than pure #000 — real
              skies never render as flat, dead black, and the slight tone gives
              the dome a touch of depth without introducing any fabricated
              imagery (that's what MultiSpectrumSphere's real sky-survey
              textures are for, once wired into a UI toggle). */}
          <color attach="background" args={['#010314']} />
          <ambientLight intensity={0.2} />
          <CelestialSphere buffers={buffers} onHoverStar={onHoverStar} onSelectStar={onSelectStar} />
          {showConstellations && <ConstellationLines buffer={constellationBuffer} opacity={0.25} />}
          {showGrid && <AltAzGrid opacity={0.18} />}
          {/* enableZoom/enablePan off — this is a look-around-from-inside-a-
              fixed-radius-dome control, not a free-fly camera; zooming or
              panning away from the observer's real position would break the
              Alt/Az projection's whole premise. */}
          <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.4} target={[0, 0, -1]} />
        </Canvas>
      </CanvasErrorBoundary>
      {contextLost && <CanvasFallbackNotice reason="lost" onRetry={remountCanvas} />}
    </>
  );
}

export { POSITION_TICK_MS };
