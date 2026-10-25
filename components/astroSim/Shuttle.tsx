'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// A Space-Shuttle-shaped vehicle built from plain shapes (no model file).
// 1 unit = 1 metre, nose toward -Z, up = +Y. Roughly orbiter-sized:
// ~37 m long, 24 m wingspan, ~17 m tall with the tail.

const WHITE = '#e9ebee';
const BLACK = '#15171a';
const GREY = '#6b7077';

function wingGeometry(depth: number) {
  // Delta wing outline in (x, z). The shape's y becomes z after the rotation.
  const s = new THREE.Shape();
  s.moveTo(2.2, -7);
  s.lineTo(12, 10.5);
  s.lineTo(12, 13);
  s.lineTo(2.6, 13.2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2); // extrusion now runs downward (-y)
  return g;
}

function tailGeometry() {
  const s = new THREE.Shape(); // (z, y) profile
  s.moveTo(5, 2.2);
  s.lineTo(12.2, 10.5);
  s.lineTo(14.2, 10.5);
  s.lineTo(14.4, 2.2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // shape x -> z, thickness along x
  g.translate(0.25, 0, 0);
  return g;
}

export function Orbiter({ throttle = 0 }: { throttle?: number }) {
  const wing = useMemo(() => wingGeometry(0.35), []);
  const wingUnder = useMemo(() => wingGeometry(0.18), []);
  const tail = useMemo(() => tailGeometry(), []);
  const white = <meshStandardMaterial color={WHITE} roughness={0.55} metalness={0.1} />;
  const black = <meshStandardMaterial color={BLACK} roughness={0.8} />;
  const grey = <meshStandardMaterial color={GREY} roughness={0.5} metalness={0.6} />;

  return (
    <group>
      {/* fuselage + rounded nose */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.7, 2.7, 28, 28]} />
        {white}
      </mesh>
      <mesh position={[0, 0, -14]} scale={[1, 0.9, 2.3]}>
        <sphereGeometry args={[2.7, 28, 20]} />
        {black}
      </mesh>
      {/* belly tiles */}
      <mesh position={[0, -1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.75, 2.75, 27.5, 28, 1, false, Math.PI * 0.65, Math.PI * 0.7]} />
        {black}
      </mesh>
      {/* cockpit windows */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 1.7, -15.4]} rotation={[-0.6, 0, 0]}>
          <boxGeometry args={[1.0, 0.1, 0.9]} />
          <meshStandardMaterial color="#0b1a2e" roughness={0.2} metalness={0.8} />
        </mesh>
      ))}
      {/* wings: white top slab over black underside, both sides */}
      {[1, -1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <mesh geometry={wing} position={[0, -1.1, 0]}>
            <meshStandardMaterial color={WHITE} roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={wingUnder} position={[0, -1.45, 0]}>
            <meshStandardMaterial color={BLACK} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* vertical tail */}
      <mesh geometry={tail}>
        <meshStandardMaterial color={WHITE} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* OMS pods */}
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 2.2, 11]}>
          <boxGeometry args={[1.5, 1.2, 4.5]} />
          {white}
        </mesh>
      ))}
      {/* main engines */}
      {[
        [0, 0.9],
        [-1.7, -0.6],
        [1.7, -0.6],
      ].map(([x, y]) => (
        <group key={`${x}${y}`} position={[x, y, 14.6]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.1, 0.45, 2.4, 20]} />
            {grey}
          </mesh>
          {throttle > 0.02 && (
            <mesh position={[0, 0, 2.2 + throttle * 3]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1 + throttle * 3, 1]}>
              <coneGeometry args={[0.9, 4, 16, 1, true]} />
              <meshBasicMaterial color="#9bd0ff" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** External tank + two boosters + orbiter, standing on its tail along +Y. Base at y = 0. */
export function LaunchStack() {
  return (
    <group>
      {/* external tank */}
      <mesh position={[0, 25.5, 0]}>
        <cylinderGeometry args={[4.2, 4.2, 47, 28]} />
        <meshStandardMaterial color="#c8691f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 53, 0]}>
        <coneGeometry args={[4.2, 12, 28]} />
        <meshStandardMaterial color="#c8691f" roughness={0.9} />
      </mesh>
      {/* solid boosters */}
      {[-6.2, 6.2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 22.5, 0]}>
            <cylinderGeometry args={[1.85, 1.85, 45, 20]} />
            <meshStandardMaterial color={WHITE} roughness={0.6} />
          </mesh>
          <mesh position={[0, 48.5, 0]}>
            <coneGeometry args={[1.85, 7, 20]} />
            <meshStandardMaterial color={GREY} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[1.2, 2.1, 2.6, 16]} />
            <meshStandardMaterial color={GREY} roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      ))}
      {/* orbiter on the tank's +Z side, nose up, belly toward the tank */}
      <group position={[0, 18.7, 6.9]} rotation={[Math.PI / 2, 0, 0]}>
        <Orbiter />
      </group>
    </group>
  );
}
