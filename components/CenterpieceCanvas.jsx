import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';

function ArmillaryCore() {
  const outerRingRef = useRef();
  const yugaRingRef = useRef();
  const innerCoreRef = useRef();

  useFrame((state, delta) => {
    if (outerRingRef.current) outerRingRef.current.rotation.z += delta * 0.05;
    if (yugaRingRef.current) {
      yugaRingRef.current.rotation.x += delta * 0.08;
      yugaRingRef.current.rotation.y += delta * 0.03;
    }
    if (innerCoreRef.current) innerCoreRef.current.rotation.z -= delta * 0.12;
  });

  return (
    <group rotation={[0.4, 0.2, 0.1]}>
      {/* Outer Precession Ring */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[3.2, 0.015, 16, 100]} />
        <meshBasicMaterial color="#f59e0b" opacity={0.6} transparent />
      </mesh>

      {/* Tilted Yuga Epoch Ring */}
      <mesh ref={yugaRingRef}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#06b6d4" opacity={0.8} transparent wireframe />
      </mesh>

      {/* Inner Harmonic Core */}
      <mesh ref={innerCoreRef}>
        <icosahedronGeometry args={[1.2, 2]} />
        <meshBasicMaterial color="#fbbf24" opacity={0.25} transparent wireframe />
      </mesh>

      {/* Center Singularity */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
      </mesh>
    </group>
  );
}

export default function CenterpieceCanvas() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
      <div className="w-[600px] h-[600px]">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <ArmillaryCore />
          </Float>
        </Canvas>
      </div>
    </div>
  );
}