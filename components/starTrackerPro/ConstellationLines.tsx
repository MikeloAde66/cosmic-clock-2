'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ConstellationLineBuffer } from '@/lib/starTrackerPro/constellationLines';

// Subtle by default (opacity prop, 20-30% per the brief) so the stick
// figures read as context, not competing visually with the star field
// itself. Rebuilt only when `buffer` changes (same real-position-tick
// cadence as CelestialSphere's own stars — see StarTrackerProCanvas),
// never per animation frame.
export default function ConstellationLines({ buffer, opacity = 0.25 }: { buffer: ConstellationLineBuffer | null; opacity?: number }) {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry || !buffer) return;
    geometry.setAttribute('position', new THREE.BufferAttribute(buffer.positions, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }, [buffer]);

  if (!buffer || buffer.positions.length === 0) return null;

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color="#67e8f9" transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}
