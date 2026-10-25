'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { LaunchStack, Orbiter } from './Shuttle';

// Stick values, each -1..1, y up-positive. Left = yaw + throttle, right = roll + pitch.
export interface DroneInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

export interface DroneHud {
  speed: number;
  throttle: number;
  moonDist: number;
}

const LAUNCH_SECONDS = 5;

function countdownLabel(t: number): string {
  if (t < 1) return 'T-3';
  if (t < 2) return 'T-2';
  if (t < 3) return 'T-1';
  if (t < 3.6) return 'IGNITION';
  return 'LIFTOFF';
}

// ---------------------------------------------------------------- launch pad

function PadScene({ onLabel, onDone }: { onLabel: (s: string) => void; onDone: () => void }) {
  const t = useRef(0);
  const lastLabel = useRef('');
  const done = useRef(false);
  const stack = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const smoke = useRef<(THREE.Mesh | null)[]>([]);
  const { camera } = useThree();
  const puffs = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({ a: (i / 28) * Math.PI * 2 + (i % 3), d: 6 + (i % 7) * 4, delay: (i % 5) * 0.12 })),
    [],
  );

  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1);
    const time = t.current;
    const label = countdownLabel(time);
    if (label !== lastLabel.current) {
      lastLabel.current = label;
      onLabel(label);
    }
    const lift = Math.max(0, time - 3.4);
    const y = 0.5 * 26 * lift * lift;
    if (stack.current) {
      stack.current.position.y = y;
      stack.current.position.x = time > 3.4 ? Math.sin(time * 40) * 0.05 : 0;
    }
    const burning = time >= 3;
    if (flame.current) {
      flame.current.visible = burning;
      const k = Math.min(1, (time - 3) / 0.6);
      flame.current.scale.set(1 + Math.sin(time * 60) * 0.06, k * (1 + Math.sin(time * 45) * 0.1), 1 + Math.sin(time * 52) * 0.06);
      flame.current.position.y = y - 12 * k;
    }
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const p = puffs[i];
      const s = time - 3 - p.delay;
      m.visible = s > 0;
      if (s > 0) {
        const grow = 1 + s * 5;
        m.scale.setScalar(grow * 2.2);
        m.position.set(Math.cos(p.a) * (p.d + s * 7), 2 + s * 1.5, Math.sin(p.a) * (p.d + s * 7));
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - s * 0.2);
      }
    });
    // camera: holds on the pad, then tilts up to follow the stack
    camera.position.set(70, 14, 105);
    camera.lookAt(0, 34 + y * 0.55, 0);
    if (time >= LAUNCH_SECONDS && !done.current) {
      done.current = true;
      onDone();
    }
  });

  return (
    <>
      <color attach="background" args={['#9cc3e6']} />
      <fog attach="fog" args={['#b7d3ea', 160, 700]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, 120, 60]} intensity={2.2} />
      {/* ground and pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#6f7f58" roughness={1} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[70, 1.8, 70]} />
        <meshStandardMaterial color="#8d9094" roughness={0.9} />
      </mesh>
      {/* service tower */}
      <mesh position={[-22, 38, 0]}>
        <boxGeometry args={[6, 76, 6]} />
        <meshStandardMaterial color="#a7332a" roughness={0.8} />
      </mesh>
      <mesh position={[-13, 40, 0]}>
        <boxGeometry args={[14, 2.5, 3]} />
        <meshStandardMaterial color="#a7332a" roughness={0.8} />
      </mesh>
      <group ref={stack} position={[0, 1.8, 0]}>
        <LaunchStack />
      </group>
      <mesh ref={flame} visible={false} position={[0, 0, 0]}>
        <coneGeometry args={[6, 26, 20, 1, true]} />
        <meshBasicMaterial color="#ff8a1f" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(m) => void (smoke.current[i] = m)} visible={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#e6e6e6" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// -------------------------------------------------------------------- flight

const MOON_RADIUS = 4000;
const MOON_POS = new THREE.Vector3(-2600, -500, -9000);
const MAX_SPEED = 420;

function Moon() {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(
      '/textures/moon.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (alive) setMap(tex);
      },
      undefined,
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  return (
    <mesh position={MOON_POS} rotation={[0.1, 2.2, 0]}>
      <sphereGeometry args={[MOON_RADIUS, 96, 64]} />
      <meshStandardMaterial key={map ? 'textured' : 'plain'} map={map ?? undefined} color={map ? '#ffffff' : '#7a7a7a'} roughness={1} />
    </mesh>
  );
}

function FlightScene({ inputs, onHud }: { inputs: React.RefObject<DroneInputs>; onHud: (h: DroneHud) => void }) {
  const ship = useRef<THREE.Group>(null);
  const state = useRef({ thr: 0, speed: 0, hudT: 0 });
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const [thrust, setThrust] = useState(0);
  const { camera } = useThree();
  const q = useMemo(() => new THREE.Quaternion(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = {
      w: 'w', s: 's', a: 'a', d: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (k && !typing(e)) {
        keys.current[k] = 1;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (k) keys.current[k] = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    camera.position.set(0, 16, 70);
  }, [camera]);

  useFrame((_, rawDt) => {
    const g = ship.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    const k = keys.current;
    // gamepad (standard mapping): left stick yaw/throttle, right stick roll/pitch
    let gl = { x: 0, y: 0 }, gr = { x: 0, y: 0 };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) {
        const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
        gl = { x: dz(p.axes[0] ?? 0), y: -dz(p.axes[1] ?? 0) };
        gr = { x: dz(p.axes[2] ?? 0), y: -dz(p.axes[3] ?? 0) };
        break;
      }
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const i = inputs.current;
    const yaw = clamp(i.lx + gl.x + k.d - k.a);
    const thrIn = clamp(i.ly + gl.y + k.w - k.s);
    const roll = clamp(i.rx + gr.x + k.right - k.left);
    const pitch = clamp(i.ry + gr.y + k.up - k.down);

    s.thr = Math.max(0, Math.min(1, s.thr + thrIn * dt * 0.45));
    s.speed += (s.thr * MAX_SPEED - s.speed) * Math.min(1, dt * 1.4);

    // orientation in the ship's own axes: yaw right = -Y, pitch up = +X, roll right = -Z
    q.copy(g.quaternion);
    euler.set(pitch * dt * 0.9, -yaw * dt * 0.8, -roll * dt * 1.3, 'YXZ');
    const dq = new THREE.Quaternion().setFromEuler(euler);
    g.quaternion.copy(q.multiply(dq)).normalize();

    tmp.set(0, 0, -1).applyQuaternion(g.quaternion).multiplyScalar(s.speed * dt);
    g.position.add(tmp);

    // keep out of the Moon
    const toMoon = g.position.clone().sub(MOON_POS);
    const dist = toMoon.length() - MOON_RADIUS;
    if (dist < 25) {
      g.position.copy(MOON_POS).add(toMoon.normalize().multiplyScalar(MOON_RADIUS + 25));
      s.speed *= 0.9;
      s.thr *= 0.9;
    }

    // chase camera
    camTarget.set(0, 16, 70).applyQuaternion(g.quaternion).add(g.position);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 4));
    camera.up.set(0, 1, 0).applyQuaternion(g.quaternion);
    tmp.set(0, 3, -80).applyQuaternion(g.quaternion).add(g.position);
    camera.lookAt(tmp);

    s.hudT += dt;
    if (s.hudT > 0.15) {
      s.hudT = 0;
      setThrust(s.thr);
      onHud({ speed: s.speed, throttle: s.thr, moonDist: Math.max(0, dist) });
    }
  });

  return (
    <>
      <color attach="background" args={['#000005']} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[3000, 1200, 2000]} intensity={2.6} />
      <Stars radius={60000} depth={2000} count={5000} factor={400} fade={false} />
      <Moon />
      <group ref={ship}>
        <Orbiter throttle={thrust} />
      </group>
    </>
  );
}

// ---------------------------------------------------------------------- root

export default function DroneScene({
  phase,
  inputs,
  onLabel,
  onLaunchDone,
  onHud,
}: {
  phase: 'pad' | 'flight';
  inputs: React.RefObject<DroneInputs>;
  onLabel: (s: string) => void;
  onLaunchDone: () => void;
  onHud: (h: DroneHud) => void;
}) {
  return (
    <Canvas camera={{ position: [70, 14, 105], fov: 50, near: 0.5, far: 200000 }} dpr={[1, 2]}>
      {phase === 'pad' ? <PadScene onLabel={onLabel} onDone={onLaunchDone} /> : <FlightScene inputs={inputs} onHud={onHud} />}
    </Canvas>
  );
}
