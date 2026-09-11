'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { IdentifiedStar, StarInstanceBuffers } from '@/lib/starTrackerPro/starCatalogBuffers';

// Radius of the fixed-distance dome every star (and satellite marker) is
// rendered on — real angular position (Alt/Az), not real distance; the
// legacy 2D dome made the exact same simplification, since actual stellar
// distances span light-years and can't be rendered to real scale alongside
// a telescope's local sky.
export const DOME_RADIUS = 100;

// Instance matrices are only rebuilt when `buffers` itself changes (a new
// object reference, pushed down whenever the parent recomputes real Alt/Az
// on its own clock tick — see useStarTrackerClock), not on every animation
// frame. Real sidereal drift is ~15°/hour; recomputing 900-ish instance
// matrices 60 times a second to display positions that haven't actually
// moved between two consecutive frames would be wasted GPU/CPU work, not
// genuine 60fps rendering.
export interface HoveredStarInfo {
  star: IdentifiedStar;
  clientX: number;
  clientY: number;
}

export interface CelestialSphereProps {
  buffers: StarInstanceBuffers | null;
  onHoverStar?: (info: HoveredStarInfo | null) => void;
  onSelectStar?: (star: IdentifiedStar) => void;
}

// Soft radial-gradient sprite so stars read as glowing points of light
// rather than flat gray discs — purely a rendering technique (a generated
// alpha gradient), not new star data: size/brightness are still driven
// entirely by each star's real magnitude via `sizes`/`sizeForMagnitude`.
// Built once on an offscreen canvas since it never depends on any star's
// actual data.
function useGlowTexture(): THREE.Texture {
  const texture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Built via `new THREE.CanvasTexture(...)` outside the JSX tree, so R3F's
  // own auto-dispose (which only walks objects it constructed from JSX
  // elements) never sees it — without this it leaks a GPU texture on every
  // remount.
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return texture;
}

// R3F's own pointer-event system already does real raycasting against a
// mesh (including instanced ones, giving a real instanceId in the event) —
// no need for a second, manually-managed THREE.Raycaster alongside it.
export default function CelestialSphere({ buffers, onHoverStar, onSelectStar }: CelestialSphereProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const glowTexture = useGlowTexture();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !buffers) return;
    for (let i = 0; i < buffers.count; i++) {
      dummy.position.set(buffers.positions[i * 3], buffers.positions[i * 3 + 1], buffers.positions[i * 3 + 2]);
      dummy.scale.setScalar(buffers.sizes[i]);
      // Faces the origin (the observer) so each star's glow-sprite billboard
      // reads correctly regardless of where it sits on the dome.
      dummy.lookAt(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = buffers.count;
  }, [buffers, dummy]);

  // capacity is a fixed upper bound (real catalog size, ~921 today) — the
  // effect above only ever sets `.count` at or below it as real per-tick
  // horizon-filtered visibility changes, never resizes the buffer itself.
  const capacity = buffers?.positions.length ? buffers.positions.length / 3 : 0;
  if (capacity === 0) return null;

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const star = event.instanceId !== undefined ? (buffers?.stars[event.instanceId] ?? null) : null;
    onHoverStar?.(star ? { star, clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY } : null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.instanceId === undefined || !buffers) return;
    const star = buffers.stars[event.instanceId];
    if (star) onSelectStar?.(star);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      frustumCulled={false}
      onPointerMove={handlePointerMove}
      onPointerOut={() => onHoverStar?.(null)}
      onClick={handleClick}
    >
      {/* Circular (not square) geometry so the glow sprite's clickable/
          hoverable area matches its visible extent — raycasting hit-tests
          against geometry, not texture alpha, so a plane would leave the
          fully-transparent corners of the gradient still pickable. */}
      <circleGeometry args={[0.4, 16]} />
      <meshBasicMaterial
        map={glowTexture}
        color="#f8fafc"
        toneMapped={false}
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
