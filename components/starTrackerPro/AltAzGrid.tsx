'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { horizonToSceneDirection } from '@/lib/starTrackerPro/coordinates';
import { DOME_RADIUS } from './CelestialSphere';

const ALTITUDE_RING_STEP_DEG = 30; // rings at 0° (horizon), 30°, 60° — 90° (zenith) is a point, not a ring
const AZIMUTH_LINE_STEP_DEG = 30; // radial lines every 30° (12 of them — includes the 4 cardinal directions)
const SEGMENTS_PER_RING = 128;

// Pure Alt/Az geometry — unlike stars/constellations, grid lines are fixed
// relative to the observer's own local horizon and don't depend on time or
// RA/Dec at all, so this is computed once (useMemo, no props that change
// per clock tick) rather than rebuilt on every position tick.
export default function AltAzGrid({ opacity = 0.18 }: { opacity?: number }) {
  const { ringPositions, radialPositions } = useMemo(() => {
    const rings: number[] = [];
    for (let altDeg = 0; altDeg < 90; altDeg += ALTITUDE_RING_STEP_DEG) {
      for (let i = 0; i < SEGMENTS_PER_RING; i++) {
        const az1 = (i / SEGMENTS_PER_RING) * 360;
        const az2 = ((i + 1) / SEGMENTS_PER_RING) * 360;
        rings.push(...horizonToSceneDirection({ altitudeDeg: altDeg, azimuthDeg: az1 }, DOME_RADIUS));
        rings.push(...horizonToSceneDirection({ altitudeDeg: altDeg, azimuthDeg: az2 }, DOME_RADIUS));
      }
    }

    const radials: number[] = [];
    for (let azDeg = 0; azDeg < 360; azDeg += AZIMUTH_LINE_STEP_DEG) {
      radials.push(...horizonToSceneDirection({ altitudeDeg: 0, azimuthDeg: azDeg }, DOME_RADIUS));
      radials.push(...horizonToSceneDirection({ altitudeDeg: 90, azimuthDeg: azDeg }, DOME_RADIUS));
    }

    return { ringPositions: new Float32Array(rings), radialPositions: new Float32Array(radials) };
  }, []);

  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ringPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={opacity} depthWrite={false} />
      </lineSegments>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[radialPositions, 3]} />
        </bufferGeometry>
        {/* Horizon/radials read slightly brighter than the altitude rings
            so "where's the ground" stays legible even at low opacity. */}
        <lineBasicMaterial color="#38bdf8" transparent opacity={Math.min(1, opacity * 1.4)} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
