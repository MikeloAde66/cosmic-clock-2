'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { latLonToVec3, vec3ToLatLon } from '@/lib/astro/coords';
import { findLockedTarget, lockRadiusDeg, type LunarTarget } from '@/lib/lunar';

export interface Cursor {
  latDeg: number;
  lonDeg: number;
  target: LunarTarget | null;
}

const GRID_STEP_DEG = 15;

// Lat/lon graticule drawn with the same latLonToVec3 used to place targets,
// so the overlay and the picking can never disagree.
function buildGrid(): { minor: THREE.BufferGeometry; major: THREE.BufferGeometry } {
  const minor: number[] = [];
  const major: number[] = [];
  const push = (arr: number[], a: ReturnType<typeof latLonToVec3>, b: ReturnType<typeof latLonToVec3>) =>
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const R = 1.004;
  const seg = 2;
  for (let lat = -75; lat <= 75; lat += GRID_STEP_DEG) {
    const arr = lat === 0 ? major : minor;
    for (let lon = -180; lon < 180; lon += seg) push(arr, latLonToVec3(lat, lon, R), latLonToVec3(lat, lon + seg, R));
  }
  for (let lon = -180; lon < 180; lon += GRID_STEP_DEG) {
    const arr = lon === 0 ? major : minor;
    for (let lat = -90; lat < 90; lat += seg) push(arr, latLonToVec3(lat, lon, R), latLonToVec3(lat + seg, lon, R));
  }
  const make = (a: number[]) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  return { minor: make(minor), major: make(major) };
}

function Grid({ visible }: { visible: boolean }) {
  const { minor, major } = useMemo(() => buildGrid(), []);
  if (!visible) return null;
  const mat = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const;
  return (
    <group>
      <lineSegments geometry={minor}>
        <lineBasicMaterial color="#1e8fa8" opacity={0.45} {...mat} />
      </lineSegments>
      <lineSegments geometry={major}>
        <lineBasicMaterial color="#5ff0ff" opacity={0.9} {...mat} />
      </lineSegments>
    </group>
  );
}

// Targeting reticle: ring + crosshair ticks, additive blended so it glows
// over both the dark maria and bright ejecta. It sits on the surface at the
// pointer hit, faces outward, and keeps a constant on-screen size.
function Reticle({ hitRef, locked }: { hitRef: React.RefObject<THREE.Vector3 | null>; locked: LunarTarget | null }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const ticks = useMemo(() => {
    const pts: number[] = [];
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      pts.push(c * 1.15, s * 1.15, 0, c * 1.7, s * 1.7, 0);
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const hit = hitRef.current;
    g.visible = hit != null;
    if (!hit) return;
    g.position.copy(hit).normalize().multiplyScalar(1.006);
    g.lookAt(g.position.clone().multiplyScalar(2));
    const dist = camera.position.distanceTo(g.position);
    let s = dist * 0.05;
    if (locked) {
      // Close the ring down to the feature's own angular size once locked.
      const r = Math.sin((lockRadiusDeg(locked) * Math.PI) / 180);
      s = Math.max(s * 0.6, r);
    }
    g.scale.setScalar(s);
  });

  const color = locked ? '#ffb347' : '#5ff0ff';
  const mat = { transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false } as const;
  return (
    <group ref={group} visible={false} renderOrder={10}>
      <mesh>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} opacity={0.95} {...mat} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color={color} opacity={0.95} {...mat} />
      </mesh>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color={color} opacity={0.95} {...mat} />
      </lineSegments>
    </group>
  );
}

// Smoothly swings the camera to look straight down at a chosen lat/lon.
function FlyTo({ focus, controls }: { focus: { latDeg: number; lonDeg: number; n: number } | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  const lastN = useRef(-1);
  useEffect(() => {
    if (focus && focus.n !== lastN.current) {
      lastN.current = focus.n;
      const v = latLonToVec3(focus.latDeg, focus.lonDeg, 1);
      const dist = Math.min(2.2, Math.max(1.6, camera.position.length()));
      goal.current = new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(dist);
    }
  }, [focus, camera]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 1 - Math.exp(-dt * 5));
    controls.current?.update();
    if (camera.position.distanceTo(goal.current) < 0.003) goal.current = null;
  });
  return null;
}

function MoonMesh({
  map,
  onCursor,
}: {
  map: THREE.Texture;
  onCursor: (c: Cursor | null) => void;
}) {
  const hit = useRef<THREE.Vector3 | null>(null);
  const [locked, setLocked] = useState<LunarTarget | null>(null);

  const handle = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    hit.current = e.point.clone();
    const { latDeg, lonDeg } = vec3ToLatLon(hit.current);
    const target = findLockedTarget(latDeg, lonDeg);
    setLocked(target);
    onCursor({ latDeg, lonDeg, target });
  };
  const leave = () => {
    hit.current = null;
    setLocked(null);
    onCursor(null);
  };

  return (
    <>
      <mesh onPointerMove={handle} onClick={handle} onPointerOut={leave}>
        <sphereGeometry args={[1, 128, 64]} />
        <meshStandardMaterial map={map} roughness={1} metalness={0} />
      </mesh>
      <Reticle hitRef={hit} locked={locked} />
    </>
  );
}

export default function MoonScene({
  map,
  gridVisible,
  focus,
  initialView,
  onCursor,
}: {
  map: THREE.Texture;
  gridVisible: boolean;
  focus: { latDeg: number; lonDeg: number; n: number } | null;
  initialView: { latDeg: number; lonDeg: number };
  onCursor: (c: Cursor | null) => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const start = useMemo(() => {
    const v = latLonToVec3(initialView.latDeg, initialView.lonDeg, 3.2);
    return [v.x, v.y, v.z] as [number, number, number];
  }, [initialView]);

  return (
    <Canvas camera={{ position: start, fov: 40, near: 0.05, far: 100 }} dpr={[1, 2]}>
      <color attach="background" args={['#02030a']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 2, 4]} intensity={2.4} />
      <Stars radius={60} depth={30} count={3000} factor={3} fade />
      <MoonMesh map={map} onCursor={onCursor} />
      <Grid visible={gridVisible} />
      <OrbitControls ref={controls} enablePan={false} minDistance={1.25} maxDistance={6} rotateSpeed={0.6} zoomSpeed={0.7} />
      <FlyTo focus={focus} controls={controls} />
    </Canvas>
  );
}
