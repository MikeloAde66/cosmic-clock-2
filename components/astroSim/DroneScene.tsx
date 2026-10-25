'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { LaunchStack } from './Shuttle';

// Stick values, each -1..1, y up-positive. Left = yaw + throttle, right = roll + pitch.
export interface DroneInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  /** Set to a new timestamp to ask the autopilot to swing the nose toward the Moon. */
  recenter?: number;
}

export interface DroneHud {
  speed: number;
  throttle: number;
  moonDist: number;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  /** 0..1, how directly the pilot is looking into the Sun. */
  sunGlow: number;
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
const MIN_THROTTLE = 0.12; // the vessel never sits still: there is always a cruise
const SUN_DIR = new THREE.Vector3(3000, 1200, 2000).normalize();

function Moon() {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  const mesh = useRef<THREE.Mesh>(null);
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
  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.004; // slow, endless turn
  });
  return (
    <mesh ref={mesh} position={MOON_POS} rotation={[0.1, 2.2, 0]}>
      <sphereGeometry args={[MOON_RADIUS, 96, 64]} />
      <meshStandardMaterial key={map ? 'textured' : 'plain'} map={map ?? undefined} color={map ? '#ffffff' : '#7a7a7a'} roughness={1} />
    </mesh>
  );
}

// A soft additive glow standing in for the Sun's disc and halo.
function SunGlow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,245,1)');
    grad.addColorStop(0.08, 'rgba(255,244,214,0.95)');
    grad.addColorStop(0.25, 'rgba(255,200,120,0.35)');
    grad.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <sprite position={SUN_DIR.clone().multiplyScalar(60000)} scale={[16000, 16000, 1]}>
      <spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
}

// Pilot's-eye flight: no vehicle in view, the camera IS the cockpit window.
function FlightScene({ inputs, onHud }: { inputs: React.RefObject<DroneInputs>; onHud: (h: DroneHud) => void }) {
  const ship = useRef<THREE.Group>(null);
  const state = useRef({ thr: 0.25, speed: 90, yawS: 0, pitchS: 0, rollS: 0, t: 0, hudT: 0, lastRecenter: 0, auto: 0 });
  const lookM = useMemo(() => new THREE.Matrix4(), []);
  const goalQ = useMemo(() => new THREE.Quaternion(), []);
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const dq = useMemo(() => new THREE.Quaternion(), []);
  const camQ = useMemo(() => new THREE.Quaternion(), []);
  const swayQ = useMemo(() => new THREE.Quaternion(), []);
  const swayE = useMemo(() => new THREE.Euler(), []);

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

  useFrame((_, rawDt) => {
    const g = ship.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    const k = keys.current;
    s.t += dt;

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
    const yawIn = clamp(i.lx + gl.x + k.d - k.a);
    const thrIn = clamp(i.ly + gl.y + k.w - k.s);
    const rollIn = clamp(i.rx + gr.x + k.right - k.left);
    const pitchIn = clamp(i.ry + gr.y + k.up - k.down);

    // Ease every control toward its target, so nothing snaps or stops dead:
    // a critically damped feel, rates blend in and out rather than switching.
    const ease = 1 - Math.exp(-dt * 4.2);
    s.yawS += (yawIn - s.yawS) * ease;
    s.pitchS += (pitchIn - s.pitchS) * ease;
    s.rollS += (rollIn - s.rollS) * ease;

    s.thr = Math.max(MIN_THROTTLE, Math.min(1, s.thr + thrIn * dt * 0.45));
    s.speed += (s.thr * MAX_SPEED - s.speed) * (1 - Math.exp(-dt * 1.1));

    // orientation in the vessel's own axes (+ a whisper of constant drift)
    euler.set(s.pitchS * dt * 0.9, -(s.yawS * 0.8 + 0.02) * dt, -(s.rollS * 0.9 + 0.015) * dt, 'YXZ');
    dq.setFromEuler(euler);
    g.quaternion.multiply(dq).normalize();

    // autopilot: swing the nose onto the Moon, wings level, over a couple of seconds
    const rc = i.recenter ?? 0;
    if (rc && rc !== s.lastRecenter) {
      s.lastRecenter = rc;
      s.auto = 2.6;
    }
    if (s.auto > 0) {
      s.auto -= dt;
      lookM.lookAt(g.position, MOON_POS, tmp.set(0, 1, 0));
      goalQ.setFromRotationMatrix(lookM);
      g.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 2.2));
    }

    fwd.set(0, 0, -1).applyQuaternion(g.quaternion);
    g.position.addScaledVector(fwd, s.speed * dt);

    // slide around the Moon rather than stopping against it
    const toMoon = tmp.copy(g.position).sub(MOON_POS);
    const dist = toMoon.length() - MOON_RADIUS;
    if (dist < 40) {
      g.position.copy(MOON_POS).add(toMoon.normalize().multiplyScalar(MOON_RADIUS + 40));
    }

    // the camera is the pilot's head: ship pose + gentle sway + lean into turns
    swayE.set(
      Math.sin(s.t * 0.7) * 0.0035 + Math.sin(s.t * 1.9) * 0.0014,
      Math.sin(s.t * 0.5 + 1) * 0.003,
      -s.yawS * 0.07 + Math.sin(s.t * 0.9 + 2) * 0.0035,
      'YXZ',
    );
    swayQ.setFromEuler(swayE);
    camQ.copy(g.quaternion).multiply(swayQ);
    camera.quaternion.slerp(camQ, 1 - Math.exp(-dt * 12));
    camera.position.copy(g.position);

    s.hudT += dt;
    if (s.hudT > 0.1) {
      s.hudT = 0;
      const f = fwd;
      const up = tmp.set(0, 1, 0).applyQuaternion(g.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
      const pitchDeg = (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI;
      const rollDeg = (Math.atan2(right.y, up.y) * 180) / Math.PI;
      const headingDeg = ((Math.atan2(f.x, -f.z) * 180) / Math.PI + 360) % 360;
      const sunDot = f.dot(SUN_DIR);
      const sunGlow = Math.max(0, Math.min(1, (sunDot - 0.82) / 0.17));
      onHud({ speed: s.speed, throttle: s.thr, moonDist: Math.max(0, dist), pitchDeg, rollDeg, headingDeg, sunGlow });
    }
  });

  return (
    <>
      <color attach="background" args={['#000005']} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[3000, 1200, 2000]} intensity={2.6} />
      <Stars radius={60000} depth={2000} count={5000} factor={400} fade={false} speed={0.6} />
      <SunGlow />
      <Moon />
      <group ref={ship} />
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
