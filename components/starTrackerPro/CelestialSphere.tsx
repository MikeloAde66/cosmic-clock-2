'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { StarInstanceBuffers } from '@/lib/starTrackerPro/starCatalogBuffers';

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
export default function CelestialSphere({ buffers }: { buffers: StarInstanceBuffers | null }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !buffers) return;
    for (let i = 0; i < buffers.count; i++) {
      dummy.position.set(buffers.positions[i * 3], buffers.positions[i * 3 + 1], buffers.positions[i * 3 + 2]);
      dummy.scale.setScalar(buffers.sizes[i]);
      // Faces the origin (the observer) so each star's flat circle billboard
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

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, capacity]} frustumCulled={false}>
      <circleGeometry args={[0.28, 8]} />
      <meshBasicMaterial color="#f8fafc" toneMapped={false} transparent opacity={0.95} />
    </instancedMesh>
  );
}
